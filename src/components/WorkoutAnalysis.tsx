"use client";

import { useState } from "react";
import { LineChart } from "@/components/LineChart";
import { useStore } from "@/lib/store";
import type { WorkoutAnalysisResponse } from "@/services/ai/prompts/workoutAnalysis";

export function WorkoutAnalysis() {
  const [analysis, setAnalysis] = useState<WorkoutAnalysisResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<any[]>([]);

  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const sets = useStore((s) => s.sets);
  const exerciseById = useStore((s) => s.exerciseById);
  const units = useStore((s) => s.units);

  const generateAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      // Prepare workout data for analysis
      const completedSessions = sessions.filter(
        (s) => s.status === "completed",
      );
      const completedSets = sets.filter((s) => s.completed);

      // Group sets by exercise
      const exerciseStats = new Map<
        string,
        {
          totalSets: number;
          totalVolume: number;
          rpeSum: number;
          rpeCount: number;
          weights: number[];
          exerciseName: string;
          muscleGroup: string;
        }
      >();

      completedSets.forEach((set) => {
        const ex = exerciseById(set.exerciseId);
        if (!ex) return;

        const stats = exerciseStats.get(set.exerciseId) || {
          totalSets: 0,
          totalVolume: 0,
          rpeSum: 0,
          rpeCount: 0,
          weights: [] as number[],
          exerciseName: ex.name,
          muscleGroup: ex.primaryMuscle || "General",
        };

        stats.totalSets++;
        stats.totalVolume += (set.actualWeight || 0) * (set.actualReps || 0);
        if (set.rpe) {
          stats.rpeSum += set.rpe;
          stats.rpeCount++;
        }
        if (set.actualWeight) {
          stats.weights.push(set.actualWeight);
        }

        exerciseStats.set(set.exerciseId, stats);
      });

      // Convert to array and calculate progression
      const exercises = Array.from(exerciseStats.entries()).map(
        ([id, stats]) => {
          const avgRPE = stats.rpeCount > 0 ? stats.rpeSum / stats.rpeCount : 0;
          const lastWeight = stats.weights[stats.weights.length - 1] || 0;
          const bestWeight = Math.max(...stats.weights, 0);

          // Simple progression detection
          let progressionTrend:
            | "improving"
            | "stable"
            | "declining"
            | "insufficient_data";
          if (stats.weights.length < 3) {
            progressionTrend = "insufficient_data";
          } else {
            const recent = stats.weights.slice(-3);
            const trend = recent[2] - recent[0];
            if (trend > 0) progressionTrend = "improving";
            else if (trend < 0) progressionTrend = "declining";
            else progressionTrend = "stable";
          }

          return {
            exerciseId: id,
            exerciseName: stats.exerciseName,
            muscleGroup: stats.muscleGroup,
            totalSets: stats.totalSets,
            totalVolume: stats.totalVolume,
            averageRPE: avgRPE,
            progressionTrend,
            lastWeight,
            bestWeight,
            consistency: 85, // Placeholder - would need planned vs actual data
          };
        },
      );

      const totalVolume = exercises.reduce(
        (sum, ex) => sum + ex.totalVolume,
        0,
      );
      const avgSessionRPE =
        exercises.length > 0
          ? exercises.reduce((sum, ex) => sum + ex.averageRPE, 0) /
            exercises.length
          : 0;

      const analysisData = {
        userProfile: {
          goal: profile.goal || "health",
          experience: profile.experience || "beginner",
          age: 30, // Placeholder - would need to be added to UserProfile
          sex: "other" as const, // Placeholder - would need to be added to UserProfile
        },
        workoutData: {
          totalWorkouts: completedSessions.length,
          dateRange: "last 30 days",
          exercises: exercises.slice(0, 10),
          overallStats: {
            totalVolume,
            averageSessionRPE: avgSessionRPE,
            adherenceRate: 85, // Placeholder
            frequency:
              completedSessions.length > 0
                ? Math.round(completedSessions.length / 4)
                : 0,
            restDays: 2,
          },
        },
        timeframe: "last 4 weeks",
      };

      const response = await fetch("/api/ai/workout-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze_workout",
          data: analysisData,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate analysis");
      }

      const result = await response.json();
      setAnalysis(result.analysis);
      setExercises(exercises); // Store exercises for chart display
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  if (!analysis) {
    return (
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">AI Workout Analysis</h2>
        <p className="text-sm text-muted">
          Get personalized insights about your strengths, weaknesses, and
          progression patterns.
        </p>
        <button
          className="btn-primary w-full py-4 text-base font-semibold"
          onClick={generateAnalysis}
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Generate Analysis"}
        </button>
        {error && <div className="text-sm text-danger">{error}</div>}
      </div>
    );
  }

  const performanceLevelColors = {
    excellent: "bg-green text-onStatus",
    good: "bg-accentFill text-onAccent",
    moderate: "bg-amber text-onStatus",
    needs_improvement: "bg-danger text-onStatus",
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI Workout Analysis</h2>
          <button
            className="text-sm text-accent"
            onClick={() => setAnalysis(null)}
          >
            Regenerate
          </button>
        </div>

        {/* Overall Assessment */}
        <div
          className={`rounded-card p-4 ${performanceLevelColors[analysis.overallAssessment.performanceLevel]}`}
        >
          <p className="font-semibold text-base">
            {analysis.overallAssessment.summary}
          </p>
          <p className="text-sm mt-2 opacity-90">
            Key Achievement: {analysis.overallAssessment.keyAchievement}
          </p>
        </div>

        {/* Strengths */}
        {analysis.strengths.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-base">Strengths</h3>
            {analysis.strengths.map((strength, idx) => (
              <div key={idx} className="rounded-card bg-green/[0.08] p-3">
                <p className="font-semibold text-sm text-green">
                  {strength.category}
                </p>
                <p className="text-sm mt-1">{strength.description}</p>
                <p className="text-xs text-muted mt-1">
                  {strength.supportingData}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Weaknesses */}
        {analysis.weaknesses.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-base">Areas for Improvement</h3>
            {analysis.weaknesses.map((weakness, idx) => (
              <div key={idx} className="rounded-card bg-danger/[0.08] p-3">
                <p className="font-semibold text-sm text-danger">
                  {weakness.category}
                </p>
                <p className="text-sm mt-1">{weakness.description}</p>
                <p className="text-xs text-muted mt-1">
                  Impact: {weakness.impact}
                </p>
                <ul className="text-xs text-muted mt-1 list-disc list-inside">
                  {weakness.recommendations.map((rec, ridx) => (
                    <li key={ridx}>{rec}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Muscle Balance */}
        <div className="space-y-2">
          <h3 className="font-semibold text-base">Muscle Balance</h3>
          <div
            className={`rounded-card p-3 ${analysis.muscleBalance.balanced ? "bg-green/[0.08]" : "bg-amber/[0.08]"}`}
          >
            <p className="text-sm">
              {analysis.muscleBalance.balanced
                ? "✓ Your muscle groups are well balanced"
                : "⚠ Some muscle imbalances detected"}
            </p>
            {!analysis.muscleBalance.balanced && (
              <div className="mt-2 space-y-1">
                {analysis.muscleBalance.imbalances.map((imbalance, idx) => (
                  <p key={idx} className="text-xs text-muted">
                    {imbalance.muscleGroup}: {imbalance.recommendation}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Progression Analysis */}
        <div className="space-y-2">
          <h3 className="font-semibold text-base">Progression Analysis</h3>
          <div className="rounded-card bg-surface2 p-3">
            <p className="text-sm">
              Overall Trend:{" "}
              <span className="font-semibold">
                {analysis.progressionAnalysis.overallTrend}
              </span>
            </p>
            {analysis.progressionAnalysis.exercisesProgressing.length > 0 && (
              <p className="text-xs text-muted mt-1">
                Improving:{" "}
                {analysis.progressionAnalysis.exercisesProgressing.join(", ")}
              </p>
            )}
            {analysis.progressionAnalysis.exercisesPlateaued.length > 0 && (
              <p className="text-xs text-muted mt-1">
                Plateaued:{" "}
                {analysis.progressionAnalysis.exercisesPlateaued.join(", ")}
              </p>
            )}
          </div>
          {/* Progress Chart for top exercise */}
          {exercises.length > 0 && exercises[0].weights.length > 0 && (
            <div className="rounded-card bg-surface2 p-3">
              <p className="text-xs text-muted mb-2">
                {exercises[0].exerciseName} Progress
              </p>
              <LineChart
                data={exercises[0].weights.map((w: number, i: number) => ({
                  label: `Set ${i + 1}`,
                  value: w,
                }))}
                unit={units}
              />
            </div>
          )}
        </div>

        {/* Actionable Recommendations */}
        {analysis.actionableRecommendations.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-base">Recommendations</h3>
            <div className="space-y-2">
              {analysis.actionableRecommendations.map((rec, idx) => (
                <div key={idx} className="rounded-card bg-accentDim/20 p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        rec.priority === "high"
                          ? "bg-danger text-onStatus"
                          : rec.priority === "medium"
                            ? "bg-amber text-onStatus"
                            : "bg-green text-onStatus"
                      }`}
                    >
                      {rec.priority}
                    </span>
                    <span className="text-xs text-muted">{rec.category}</span>
                  </div>
                  <p className="text-sm mt-1">{rec.recommendation}</p>
                  <p className="text-xs text-muted mt-1">
                    Expected: {rec.expectedImpact}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="space-y-2">
          <h3 className="font-semibold text-base">Next Steps</h3>
          <div className="rounded-card bg-surface2 p-3 space-y-2">
            <div>
              <p className="text-xs text-muted">Focus Areas</p>
              <p className="text-sm">
                {analysis.nextSteps.focusAreas.join(", ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Weekly Goals</p>
              <p className="text-sm">
                {analysis.nextSteps.weeklyGoals.join(", ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Long-term Goals</p>
              <p className="text-sm">
                {analysis.nextSteps.longTermGoals.join(", ")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
