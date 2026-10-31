const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = "{showPlansModal && (";

const modalCode = `      <TokenCalculatorModal
        isOpen={showTokenCalculator}
        onClose={() => setShowTokenCalculator(false)}
        initialSubject={user?.subject || profileData.subject}
        onSelectPlan={(planDetails) => {
          setCustomPlanDetails(planDetails);
          setSelectedPlan(planDetails.planId);
          setShowTokenCalculator(false);
          setPlanCategoryTab('tokens');
          setShowPlansModal(true);
        }}
      />

      `;

if (code.includes(target) && !code.includes("<TokenCalculatorModal")) {
  code = code.replace(target, modalCode + target);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Added TokenCalculatorModal");
} else {
  console.log("Could not find target or modal already added");
}
