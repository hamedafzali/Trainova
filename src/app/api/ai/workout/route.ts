// AI-powered workout generation API endpoint
// Generates custom workouts based on user goals, equipment, and preferences

import { NextRequest, NextResponse } from 'next/server';
import {
  generateWorkout,
  generateQuickWorkout,
  generateWorkoutVariation,
  generateProgressionPlan,
  WorkoutGenerationError,
  type WorkoutGenerationInput,
  type GeneratedWorkout,
} from '@/services/ai/workout';
import { authorizeAiRequest, isAuthorizedAiRequest } from "@/server/aiGuard";

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAiRequest(request);
    if (!isAuthorizedAiRequest(authorization)) return authorization.response;
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'generate_workout':
        return await handleGenerateWorkout(data);
      case 'quick_workout':
        return await handleQuickWorkout(data);
      case 'variation':
        return await handleVariation(data);
      case 'progression':
        return await handleProgression(data);
      default:
        return NextResponse.json(
          { error: 'Invalid action', validActions: ['generate_workout', 'quick_workout', 'variation', 'progression'] },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Workout generation API error:', error);
    
    if (error instanceof WorkoutGenerationError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleGenerateWorkout(data: WorkoutGenerationInput) {
  const workout = await generateWorkout(data);

  return NextResponse.json({
    success: true,
    workout,
  });
}

async function handleQuickWorkout(data: {
  duration: number;
  equipment: string[];
  focus: string;
}) {
  const workout = await generateQuickWorkout(data);

  return NextResponse.json({
    success: true,
    workout,
  });
}

async function handleVariation(data: {
  originalWorkout: GeneratedWorkout;
  feedback: string;
}) {
  const workout = await generateWorkoutVariation(data.originalWorkout, data.feedback);

  return NextResponse.json({
    success: true,
    workout,
  });
}

async function handleProgression(data: {
  exercise: string;
  currentStats: {
    weight: number;
    reps: number;
    sets: number;
    rpe: number;
  };
}) {
  const plan = await generateProgressionPlan(data.exercise, data.currentStats);

  return NextResponse.json({
    success: true,
    plan,
  });
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'ai-workout-generation',
    version: '1.0.0',
  });
}
