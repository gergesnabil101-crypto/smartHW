const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `          let userDocSnap;
          try {
            userDocSnap = await getDoc(doc(db, 'users', user.uid));
          } catch (e: any) {
            if (e?.message?.toLowerCase().includes('quota') || e?.code === 'failed-precondition') {
              setIsQuotaExceeded(true);
              userDocSnap = await getDocFromCache(doc(db, 'users', user.uid));
            } else throw e;
          }

          if (userDocSnap && userDocSnap.exists()) {
            const data = userDocSnap.data() as any;
            
            const trialEnd = new Date(data.created_at || new Date().toISOString());
            trialEnd.setDate(trialEnd.getDate() + 3);
            const now = new Date();
            const isTrialActive = now < trialEnd;
            
            const subEndDate = data.subscription_end_date ? new Date(data.subscription_end_date) : null;
            const isSubActive = isTargetAdmin || (subEndDate ? now < subEndDate : true);
            const isActive = isTargetAdmin || (data.subscription_status === 'active' && isSubActive && !data.is_suspended) || isAdmin;
            
            // Auto-suspend user if subscription is expired and they are not an admin
            const hasExtraTokens = (data.extra_tokens || 0) > 0;
            if (!isTargetAdmin && !isActive && !isTrialActive && !data.is_suspended && !isAdmin && !hasExtraTokens) {
              console.log("Subscription expired, auto-suspending user...");
              updateDoc(doc(db, 'users', user.uid), { is_suspended: true }).catch(console.error);
            }
            
            const hasAccess = isTargetAdmin || isActive || (isTrialActive && !data.is_suspended) || hasExtraTokens;
            
            // Auto-unsuspend user if they were granted extra tokens
            if (!isTargetAdmin && !isAdmin && data.is_suspended && hasExtraTokens) {
              updateDoc(doc(db, 'users', user.uid), { is_suspended: false }).catch(console.error);
            }
            
            // Auto-unsuspend admin if doc was marked suspended previously in Firestore
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
              hasAccess: isTargetAdmin || hasAccess,
              isTrialActive: isTargetAdmin ? false : isTrialActive,
              isActive: isTargetAdmin || isActive,
              isSubActive: isTargetAdmin ? true : isSubActive,
              is_suspended: (isTargetAdmin || isAdmin) ? false : !!data.is_suspended,
              subscription_status: isTargetAdmin ? 'active' : (data.subscription_status || 'trial'),
              trialDaysLeft: isTrialActive ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0,
            }));`;

const replaceStr = `          if (unsubscribeUserRef.current) unsubscribeUserRef.current();
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
                updateDoc(doc(db, 'users', user.uid), { is_suspended: true }).catch(console.error);
              }
              
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

              // DB hasAccess overrides if it was set explicitly to true, otherwise calculate it
              const calculatedAccess = isTargetAdmin || isActive || (isTrialActive && !data.is_suspended) || hasExtraTokens;
              const finalHasAccess = data.hasAccess === true ? true : calculatedAccess;

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
              }));`;

content = content.replace(targetStr, replaceStr);

const endTarget = `          if (isTargetAdmin || isAdmin) {`;
const replaceEnd = `            }
          }, (e: any) => {
             if (e?.message?.toLowerCase().includes('quota') || e?.code === 'failed-precondition') setIsQuotaExceeded(true);
          });
          
          if (isTargetAdmin || isAdmin) {`;

content = content.replace(endTarget, replaceEnd);

fs.writeFileSync('src/App.tsx', content);
