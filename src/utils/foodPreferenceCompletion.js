export const getFoodPreferenceCompletion = (preferences) => {
  const diet = preferences?.diet || "omni";
  const allergies = Array.isArray(preferences?.allergies)
    ? preferences.allergies
    : [];
  const habits = preferences?.habits || {};

  const hasDietPreference = Boolean(diet && diet !== "omni");
  const hasAllergyInfo = allergies.length > 0;
  const hasTasteInfo =
    !!habits.noOnion ||
    !!habits.noCilantro ||
    Number(habits.sugar ?? 100) !== 100 ||
    String(habits.spice || "Vừa") !== "Vừa" ||
    habits.ice === false;

  const hasPersonalizationSignal = hasDietPreference || hasTasteInfo;
  const isLowInformation = !hasDietPreference && !hasAllergyInfo && !hasTasteInfo;

  return {
    hasDietPreference,
    hasAllergyInfo,
    hasTasteInfo,
    hasPersonalizationSignal,
    isLowInformation,
    shouldNudge: isLowInformation || !hasPersonalizationSignal,
    missingChips: {
      diet: !hasDietPreference,
      allergy: isLowInformation && !hasAllergyInfo,
      taste: !hasTasteInfo,
    },
  };
};
