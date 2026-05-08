import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInAnonymously,
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  writeBatch,
  doc, 
  getDocFromServer,
  setDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ProductionLog, Recipe, NVL, Overhead, MaterialUsage, LoginLog, MaterialConversion } from '../types';

const ADMIN_EMAILS = ['khoa.huynh.06.12.2000@gmail.com'];

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isGuest: boolean;
  workshop: string | null;
  setWorkshop: (name: string | null) => void;
  login: () => Promise<void>;
  loginGuest: () => Promise<void>;
  logout: () => Promise<void>;
  nvl: NVL[];
  recipes: Recipe[];
  logs: ProductionLog[];
  overheads: Overhead[];
  materialUsage: MaterialUsage[];
  loginLogs: LoginLog[];
  materialConversions: MaterialConversion[];
  syncNVL: (data: NVL[]) => Promise<void>;
  syncRecipes: (data: Recipe[]) => Promise<void>;
  syncLogs: (data: ProductionLog[]) => Promise<void>;
  syncOverheads: (data: Overhead[]) => Promise<void>;
  syncMaterialUsage: (data: MaterialUsage[]) => Promise<void>;
  syncConversions: (data: MaterialConversion[]) => Promise<void>;
  saveEntity: (col: string, id: string, data: any) => Promise<void>;
  saveBatch: (col: string, data: any[]) => Promise<void>;
  deleteEntity: (col: string, id: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [workshop, setWorkshopState] = useState<string | null>(localStorage.getItem('bakery_workshop'));

  const setWorkshop = React.useCallback((name: string | null) => {
    setWorkshopState(name);
    if (name) {
      localStorage.setItem('bakery_workshop', name);
    } else {
      localStorage.removeItem('bakery_workshop');
    }
  }, []);
  const [nvl, setNvl] = useState<NVL[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [overheads, setOverheads] = useState<Overhead[]>([]);
  const [materialUsage, setMaterialUsage] = useState<MaterialUsage[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [materialConversions, setMaterialConversions] = useState<MaterialConversion[]>([]);

  useEffect(() => {
    // Safety timeout: if auth doesn't respond in 5s, stop loading anyway
    const timer = setTimeout(() => {
      if (loading) setLoading(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      const is_admin = user ? ADMIN_EMAILS.includes(user.email || '') : false;
      setIsAdmin(is_admin);
      setIsGuest(user ? !is_admin : false);
      setLoading(false);
      clearTimeout(timer);
      
      // Clear workshop if user logs out
      if (!user) {
        setWorkshop(null);
      }
      
      if (user) {
        // Record login
        try {
          if (!db) {
            console.error("Cannot record login log: Firestore DB is not initialized.");
            return;
          }
          const logId = `log_${Date.now()}`;
          const newLog: LoginLog = {
            id: logId,
            email: user.email || (user.isAnonymous ? 'guest_user' : 'unknown'),
            displayName: user.displayName || (user.isAnonymous ? 'Khách hàng' : user.email?.split('@')[0]) || 'Ẩn danh',
            timestamp: new Date().toISOString()
          };
          await setDoc(doc(db, 'loginLogs', logId), newLog);
        } catch (e) {
          console.error("Failed to record login log", e);
        }
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // Sync logic - now active for everyone
  useEffect(() => {
    if (!user) {
      setNvl([]);
      setRecipes([]);
      setLogs([]);
      setOverheads([]);
      setMaterialUsage([]);
      setLoginLogs([]);
      setMaterialConversions([]);
      return;
    }

    // Initial connection test
    const testConnection = async () => {
      if (!db) {
        console.error("Firestore: Database instance is missing!");
        return;
      }
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore: Cloud channel active.");
      } catch (error: any) {
        console.warn("Firestore: Verification warning:", error.message);
      }
    };
    testConnection();

    // Role-based query logic
    const getQuery = (col: string) => {
      if (!db) throw new Error("Firestore DB not initialized");
      
      // Special ADMIN workshop login gets full data access
      if (isAdmin || workshop === "ADMIN") return collection(db, col);
      if (workshop) return query(collection(db, col), where('xuong', '==', workshop));
      // If guest but no workshop yet, don't fetch anything that might fail rules
      return query(collection(db, col), where('xuong', '==', '___NONE___'));
    };

    const unsubNVL = onSnapshot(getQuery('nvl'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as NVL);
      setNvl(data);
    }, (err) => console.error("Firebase NVL Sync Error:", err));

    const unsubRecipes = onSnapshot(getQuery('recipes'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Recipe);
      setRecipes(data);
    }, (err) => console.error("Firebase Recipes Sync Error:", err));

    const unsubLogs = onSnapshot(getQuery('productionLogs'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as ProductionLog);
      setLogs(data);
    }, (err) => console.error("Firebase Logs Sync Error:", err));

    const unsubOverheads = onSnapshot(getQuery('overheads'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Overhead);
      setOverheads(data);
    }, (err) => console.error("Firebase Overheads Sync Error:", err));

    const unsubUsage = onSnapshot(getQuery('materialUsage'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as MaterialUsage);
      setMaterialUsage(data);
    }, (err) => console.error("Firebase Usage Sync Error:", err));

    const unsubConversions = onSnapshot(getQuery('materialConversions'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as MaterialConversion);
      setMaterialConversions(data);
    }, (err) => console.error("Firebase Conversions Sync Error:", err));

    const unsubLoginLogs = (isAdmin || workshop === "ADMIN") && db
      ? onSnapshot(collection(db, 'loginLogs'), (snapshot) => {
          const data = snapshot.docs.map(doc => doc.data() as LoginLog);
          const sorted = data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setLoginLogs(sorted.slice(0, 10));
        }, (err) => console.error("Firebase LoginLogs Sync Error:", err))
      : () => {
          setLoginLogs([]);
          return () => {};
        };

    return () => {
      unsubNVL();
      unsubRecipes();
      unsubLogs();
      unsubOverheads();
      unsubUsage();
      unsubConversions();
      unsubLoginLogs();
    };
  }, [user, isAdmin, isGuest, workshop]); // Re-sync when workshop or role changes

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.error("Login failed:", e);
      // We'll log more details for the user if they're checking console
      if (e.code === 'auth/popup-blocked') {
        alert("Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng cho phép hiện popup và thử lại.");
      } else if (e.code === 'auth/unauthorized-domain') {
        alert("Tên miền này chưa được cấp quyền đăng nhập trong Firebase. Vui lòng liên hệ Admin.");
      } else {
        alert("Đăng nhập thất bại: " + (e.message || "Lỗi không xác định"));
      }
    }
  };

  const loginGuest = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Guest login failed:", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const saveEntity = async (col: string, id: string, data: any) => {
    try {
      await setDoc(doc(db, col, id), data);
    } catch (error: any) {
      handleFirestoreError(error, col, id, 'write');
    }
  };

  const deleteEntity = async (col: string, id: string) => {
    try {
      await deleteDoc(doc(db, col, id));
    } catch (error: any) {
      handleFirestoreError(error, col, id, 'delete');
    }
  };

  const saveBatch = async (col: string, dataList: any[]) => {
    try {
      const batch = writeBatch(db);
      dataList.forEach(item => {
        const d = doc(db, col, item.id);
        batch.set(d, item);
      });
      await batch.commit();
    } catch (error: any) {
      handleFirestoreError(error, col, 'batch', 'write');
    }
  };

  const syncNVL = async (data: NVL[]) => {
    await saveBatch('nvl', data);
  };

  const syncRecipes = async (data: Recipe[]) => {
    await saveBatch('recipes', data);
  };

  const syncLogs = async (data: ProductionLog[]) => {
    await saveBatch('productionLogs', data);
  };

  const syncOverheads = async (data: Overhead[]) => {
    await saveBatch('overheads', data);
  };

  const syncMaterialUsage = async (data: MaterialUsage[]) => {
    await saveBatch('materialUsage', data);
  };

  const syncConversions = async (data: MaterialConversion[]) => {
    await saveBatch('materialConversions', data);
  };

  const handleFirestoreError = (error: any, col: string, id: string | null, op: string) => {
    if (error.code === 'permission-denied') {
      const info = {
        error: error.message,
        operationType: op,
        path: col + (id ? `/${id}` : ''),
        authInfo: {
          userId: user?.uid || 'anonymous',
          email: user?.email || 'none',
          emailVerified: user?.emailVerified || false,
          isAnonymous: user?.isAnonymous || true,
          providerInfo: user?.providerData.map(p => ({
            providerId: p.providerId,
            displayName: p.displayName || '',
            email: p.email || ''
          })) || []
        }
      };
      console.error("Firestore Permission Denied:", JSON.stringify(info, null, 2));
      throw new Error(JSON.stringify(info));
    }
    throw error;
  };

  return (
    <FirebaseContext.Provider value={{ 
      user, loading, isAdmin, isGuest, workshop, setWorkshop, login, loginGuest, logout, 
      nvl, recipes, logs, overheads, materialUsage, loginLogs, materialConversions,
      syncNVL, syncRecipes, syncLogs, syncOverheads, syncMaterialUsage, syncConversions,
      saveEntity, saveBatch, deleteEntity
    }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
