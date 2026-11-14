import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'ar' | 'en';
const LANG_KEY = 'app_language';

const ar = {
  // Tabs
  tabQuizzes: 'اختباراتي',
  tabStudents: 'الطلاب',
  tabProfile: 'حسابي',

  // Common
  cancel: 'إلغاء',
  delete: 'حذف',
  error: 'خطأ',
  done: 'تم',
  all: 'الكل',

  // Login
  appName: 'مصحح الواجبات الذكي',
  loginSubtitle: 'سجل الدخول لمتابعة اختباراتك ونتائج طلابك',
  email: 'البريد الإلكتروني',
  password: 'كلمة المرور',
  signIn: 'تسجيل الدخول',
  forgotPassword: 'نسيت كلمة المرور؟',
  createAccount: 'إنشاء حساب معلم جديد',
  studentJoinTitle: '🎓 طالب؟ الصق رابط أو كود الاختبار',
  joinQuiz: 'دخول الاختبار',
  invalidLink: 'الرابط أو الكود غير صالح.',
  fillCredentials: 'أدخل البريد الإلكتروني وكلمة المرور.',

  // Profile
  platformAdmin: 'مدير المنصة',
  statusActive: 'نشط',
  statusAdmin: 'مدير',
  statusExpired: 'منتهي',
  statusTrial: 'تجريبي',
  dailyUsage: 'استهلاك اليوم',
  tokenUnit: 'توكن',
  subEnds: 'ينتهي الاشتراك',
  plansLink: '💳 الباقات والاشتراك — فعّل أو جدد اشتراكك',
  instructionsLink: '📖 تعليمات الاستخدام — فلاش vs برو وقواعد الرصيد',
  personalData: 'البيانات الشخصية',
  name: 'الاسم',
  phone: 'رقم الهاتف',
  subject: 'المادة',
  taughtGrades: 'الصفوف التي تدرّسها',
  preferredModel: 'نموذج الذكاء الاصطناعي المفضل',
  modelFlash: 'سريع (Flash)',
  modelPro: 'احترافي (Pro)',
  saveChanges: 'حفظ التعديلات',
  saved: 'تم حفظ بياناتك.',
  saveFailed: 'فشل الحفظ.',
  adminUsers: '👑 إدارة المستخدمين',
  adminRequests: '🧾 طلبات الاشتراك المعلقة',
  logout: 'تسجيل الخروج',
  logoutTitle: 'تسجيل الخروج',
  logoutConfirm: 'هل تريد تسجيل الخروج من حسابك؟',
  logoutBtn: 'خروج',
  language: 'لغة التطبيق',
  deleteAccount: 'حذف حسابي نهائياً',
  deleteAccountTitle: 'حذف الحساب',
  deleteAccountMsg: 'سيتم حذف حسابك وجميع اختباراتك ونتائج طلابك نهائياً. لا يمكن التراجع عن هذا الإجراء.',
  deleteAccountSure: 'تأكيد أخير: هل أنت متأكد من حذف حسابك وكل بياناتك؟',
  deleteAccountBtn: 'حذف نهائي',
  deleteAccountFail: 'فشل حذف الحساب. حاول مرة أخرى.',

  // Dashboard
  tokenBalance: '⚡ رصيد التوكنز',
  remaining: 'المتبقي',
  of: 'من',
  loadingQuizzes: 'جاري تحميل اختباراتك...',
  noQuizzesYet: 'لا توجد اختبارات بعد',
  createFirstQuiz: 'اضغط «اختبار جديد» لإنشاء أول اختبار لك',
  notifFromAdmin: 'إشعار من إدارة المنصة',
  questionsUnit: 'سؤال',
  badgeExpired: 'منتهي',
  badgeDisabled: 'معطّل',
  share: '🔗 مشاركة',
  results: '📊 النتائج',
  newQuiz: '+ اختبار جديد',
  newFolder: '+ مجلد',
  move: '📁 نقل',
  enable: '▶️ تفعيل',
  disable: '⏸ تعطيل',
  deleteAction: '🗑 حذف',
  close: 'إغلاق',
  shareTitle: 'مشاركة الاختبار',
  moveToFolder: 'نقل إلى مجلد',
  noFolder: 'بدون مجلد',
  newFolderTitle: 'مجلد جديد',
  folderName: 'اسم المجلد',
  folderNameHint: 'مثال: اختبارات شهر أكتوبر',
  create: 'إنشاء',
  deleteQuizQ: 'حذف الاختبار؟ لا يمكن التراجع عن هذا الإجراء.',
  deleteFolderQ: 'حذف المجلد؟ الاختبارات بداخله لن تُحذف.',
};

const en: typeof ar = {
  tabQuizzes: 'My Quizzes',
  tabStudents: 'Students',
  tabProfile: 'Account',

  cancel: 'Cancel',
  delete: 'Delete',
  error: 'Error',
  done: 'Done',
  all: 'All',

  appName: 'Smart Homework Grader',
  loginSubtitle: 'Sign in to manage your quizzes and student results',
  email: 'Email',
  password: 'Password',
  signIn: 'Sign in',
  forgotPassword: 'Forgot password?',
  createAccount: 'Create a teacher account',
  studentJoinTitle: '🎓 Student? Paste the quiz link or code',
  joinQuiz: 'Join quiz',
  invalidLink: 'Invalid link or code.',
  fillCredentials: 'Enter your email and password.',

  platformAdmin: 'Platform Admin',
  statusActive: 'Active',
  statusAdmin: 'Admin',
  statusExpired: 'Expired',
  statusTrial: 'Trial',
  dailyUsage: "Today's usage",
  tokenUnit: 'tokens',
  subEnds: 'Subscription ends',
  plansLink: '💳 Plans & subscription — activate or renew',
  instructionsLink: '📖 Usage guide — Flash vs Pro & balance rules',
  personalData: 'Personal details',
  name: 'Name',
  phone: 'Phone number',
  subject: 'Subject',
  taughtGrades: 'Grades you teach',
  preferredModel: 'Preferred AI model',
  modelFlash: 'Fast (Flash)',
  modelPro: 'Pro',
  saveChanges: 'Save changes',
  saved: 'Your details were saved.',
  saveFailed: 'Save failed.',
  adminUsers: '👑 Manage users',
  adminRequests: '🧾 Pending subscription requests',
  logout: 'Sign out',
  logoutTitle: 'Sign out',
  logoutConfirm: 'Sign out of your account?',
  logoutBtn: 'Sign out',
  language: 'App language',
  deleteAccount: 'Delete my account permanently',
  deleteAccountTitle: 'Delete account',
  deleteAccountMsg: 'Your account, quizzes and student results will be permanently deleted. This cannot be undone.',
  deleteAccountSure: 'Final confirmation: delete your account and all data?',
  deleteAccountBtn: 'Delete permanently',
  deleteAccountFail: 'Account deletion failed. Try again.',

  tokenBalance: '⚡ Token balance',
  remaining: 'Left',
  of: 'of',
  loadingQuizzes: 'Loading your quizzes…',
  noQuizzesYet: 'No quizzes yet',
  createFirstQuiz: 'Tap "New quiz" to create your first one',
  notifFromAdmin: 'Platform admin notice',
  questionsUnit: 'questions',
  badgeExpired: 'Expired',
  badgeDisabled: 'Disabled',
  share: '🔗 Share',
  results: '📊 Results',
  newQuiz: '+ New quiz',
  newFolder: '+ Folder',
  move: '📁 Move',
  enable: '▶️ Enable',
  disable: '⏸ Disable',
  deleteAction: '🗑 Delete',
  close: 'Close',
  shareTitle: 'Share quiz',
  moveToFolder: 'Move to folder',
  noFolder: 'No folder',
  newFolderTitle: 'New folder',
  folderName: 'Folder name',
  folderNameHint: 'e.g. October quizzes',
  create: 'Create',
  deleteQuizQ: 'Delete this quiz? This cannot be undone.',
  deleteFolderQ: 'Delete folder? Quizzes inside are kept.',
};

export type TKey = keyof typeof ar;
const dict: Record<Lang, typeof ar> = { ar, en };

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
}

const LangContext = createContext<LangState>({ lang: 'ar', setLang: () => {}, t: (k) => ar[k] });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (v === 'en' || v === 'ar') setLangState(v);
    }).catch(() => {});
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
  };

  const value = useMemo<LangState>(() => ({
    lang,
    setLang,
    t: (key) => dict[lang][key] ?? ar[key] ?? String(key),
  }), [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangState {
  return useContext(LangContext);
}
