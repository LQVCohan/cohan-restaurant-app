import { gql, useMutation, useQuery } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_FOOD_PREFERENCES,
  buildFoodPreferenceNote,
  normalizeFoodPreferencesFromUser,
} from "@/components/Customer/ForYou/foodPreferenceConfig";

const ME_FOOD_PREFERENCES_QUERY = gql`
  query MeFoodPreferences {
    me {
      id
      foodPreferences {
        diet
        allergies
        habits {
          noOnion
          noCilantro
          sugar
          spice
          ice
        }
        autoNote
        updatedAt
      }
    }
  }
`;

const UPDATE_MY_FOOD_PREFERENCES = gql`
  mutation UpdateMyFoodPreferences($input: FoodPreferencesInput!) {
    updateMyFoodPreferences(input: $input) {
      id
      foodPreferences {
        diet
        allergies
        habits {
          noOnion
          noCilantro
          sugar
          spice
          ice
        }
        autoNote
        updatedAt
      }
    }
  }
`;

export default function useFoodPreferences({ skip = false } = {}) {
  const { data, loading, error, refetch } = useQuery(ME_FOOD_PREFERENCES_QUERY, {
    fetchPolicy: "cache-and-network",
    skip,
  });
  const [preferences, setPreferences] = useState(DEFAULT_FOOD_PREFERENCES);
  const [updateMyFoodPreferences, { loading: saving }] =
    useMutation(UPDATE_MY_FOOD_PREFERENCES);

  useEffect(() => {
    if (data?.me) {
      setPreferences(normalizeFoodPreferencesFromUser(data.me));
    }
  }, [data]);

  const previewNote = useMemo(
    () => buildFoodPreferenceNote(preferences),
    [preferences],
  );

  const savePreferences = async (nextPreferences = preferences) => {
    const normalized = normalizeFoodPreferencesFromUser({
      foodPreferences: nextPreferences,
    });
    const input = {
      diet: normalized.diet,
      allergies: normalized.allergies,
      habits: normalized.habits,
    };

    const result = await updateMyFoodPreferences({ variables: { input } });

    const serverPreferences =
      result?.data?.updateMyFoodPreferences?.foodPreferences;

    const saved = serverPreferences
      ? normalizeFoodPreferencesFromUser({ foodPreferences: serverPreferences })
      : normalizeFoodPreferencesFromUser({
          foodPreferences: {
            ...normalized,
            autoNote: buildFoodPreferenceNote(normalized),
            updatedAt: new Date().toISOString(),
          },
        });

    setPreferences(saved);
    await refetch?.();

    return saved;
  };

  return {
    preferences,
    setPreferences,
    previewNote,
    loading,
    saving,
    error,
    savePreferences,
    refetch,
  };
}
