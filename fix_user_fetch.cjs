const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const startToken = "          let userDocSnap;";
const endToken = "          // If they are admin, fetch users and pending requests";

const startIndex = content.indexOf(startToken);
const endIndex = content.indexOf(endToken);

if (startIndex !== -1 && endIndex !== -1) {
    const newCode = `          if (unsubscribeUserRef.current) {
            unsubscribeUserRef.current();
          }

          unsubscribeUserRef.current = onSnapshot(doc(db, 'users', user.uid), (userDocSnap) => {
            if (userDocSnap && userDocSnap.exists()) {
              const data = userDocSnap.data() as any;
              
              const trialEnd = new Date(data.created_at || new Date().toISOString());
              trialEnd.setDate(trialEnd.getDate() + 3);
              const now = new Date();
              const isTrialActive = now < trialEnd;
              
              const subEndDate = data.subscription_end_date ? new Date(data.subscription_end_date) : null;
              const isSubActive = isTargetAdmin || (subEndDate ? now < subEndDate : true);
              const isActive = isTargetAdmin || (data.subscription_status === 'active' && isSubActive && !data.is_suspended) || isAdmin;
              
              const hasExtraTokens = (data.extra_tokens || 0) > 0;
              if (!isTargetAdmin && !isActive && !isTrialActive && !data.is_suspended && !isAdmin && !hasExtraTokens) {
                console.log("Subscription expired, auto-suspending user...");
                updateDoc(doc(db, 'users', user.uid), { is_suspended: true }).catch(console.error);
              }
              
              // DB hasAccess overrides if it was set explicitly to true, otherwise calculate it
              const calculatedAccess = isTargetAdmin || isActive || (isTrialActive && !data.is_suspended) || hasExtraTokens;
              const finalHasAccess = data.hasAccess === true ? true : calculatedAccess;
              
              if (!isTargetAdmin && !isAdmin && data.is_suspended && hasExtraTokens) {
                updateDoc(doc(db, 'users', user.uid), { is_suspended: false }).catch(console.error);
              }
              
              if ((isTargetAdmin || isAdmin) && data.is_suspended) {
                updateDoc(doc(db, 'users', user.uid), {
                  is_suspended: false,
                  subscription_status: 'active',
                  subscription_end_date: '2099-12-31T23:59:59.000Z'
                }).catch(console.error);
              }

              setUser((prev: any) => ({
                ...(prev || {}),
                ...data,
                role: (isTargetAdmin || isAdmin) ? 'admin' : (data.role || 'user'),
                isAdmin: isTargetAdmin || isAdmin,
                hasAccess: isTargetAdmin || finalHasAccess,
                isTrialActive: isTargetAdmin ? false : isTrialActive,
                isActive: isTargetAdmin || isActive,
                isSubActive: isTargetAdmin ? true : isSubActive,
                is_suspended: (isTargetAdmin || isAdmin) ? false : !!data.is_suspended,
                subscription_status: isTargetAdmin ? 'active' : (data.subscription_status || 'trial'),
                trialDaysLeft: isTrialActive ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0,
              }));
              
              // Check pending status inside snapshot if not checked
              if (!checkedPendingStatusRef.current && !data.hasPendingSubscription) {
                checkedPendingStatusRef.current = true;
                const pendingReqQ = query(collection(db, 'subscription_requests'), where('user_id', '==', user.uid), where('status', '==', 'pending'), limit(1));
                getDocs(pendingReqQ).then(pendingReqSnap => {
                    if (!pendingReqSnap.empty) {
                        setUser((prev: any) => ({ ...prev, hasPendingSubscription: true }));
                    }
                }).catch(console.error);
              }
            }
          }, (err) => {
            console.error("User snapshot error:", err);
            if (err?.message?.toLowerCase().includes('quota') || err?.code === 'failed-precondition') {
              setIsQuotaExceeded(true);
            }
          });
`;
    content = content.substring(0, startIndex) + newCode + "\n" + content.substring(endIndex);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Successfully fixed the user fetch!");
} else {
    console.log("Tokens not found!");
}
