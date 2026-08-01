// AI-powered onboarding API endpoint
// Generates personalized training programs based on user assessment

import { NextRequest, NextResponse } from 'next/server';
import {
  generateOnboardingProgram,
  generateFollowUpQuestion,
  generateWeeklyCheckIn,
  validateOnboardingInput,
  OnboardingError,
  type OnboardingInput,
} from '@/services/ai/onboarding';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'generate_program':
        return await handleGenerateProgram(data);
      case 'follow_up':
        return await handleFollowUp(data);
      case 'weekly_checkin':
        return await handleWeeklyCheckIn(data);
      case 'validate':
        return await handleValidate(data);
      default:
        return NextResponse.json(
          { error: 'Invalid action', validActions: ['generate_program', 'follow_up', 'weekly_checkin', 'validate'] },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Onboarding API error:', error);
    
    if (error instanceof OnboardingError) {
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

async function handleGenerateProgram(data: OnboardingInput) {
  // Validate input completeness
  const validation = validateOnboardingInput(data);
  if (!validation.isValid) {
    return NextResponse.json(
      {
        error: 'Incomplete onboarding data',
        missingFields: validation.missingFields,
        requiresFollowUp: true,
      },
      { status: 400 }
    );
  }

  // Generate program
  const program = await generateOnboardingProgram(data);

  return NextResponse.json({
    success: true,
    program,
  });
}

async function handleFollowUp(data: {
  missingFields: string[];
  currentData: Partial<OnboardingInput>;
}) {
  const question = await generateFollowUpQuestion(data.missingFields, data.currentData);

  return NextResponse.json({
    success: true,
    question,
  });
}

async function handleWeeklyCheckIn(data: {
  programName: string;
  weekNumber: number;
  checkInData: {
    weight?: string;
    sessionsCompleted: number;
    sessionsPlanned: number;
    painOrInjuries?: string;
    averageRPE: number;
    sleepQuality: number;
    energyLevel: number;
    whatFeltGood: string;
    whatFeltDifficult: string;
    weightChanges?: string;
  };
}) {
  const recommendations = await generateWeeklyCheckIn(
    data.programName,
    data.weekNumber,
    data.checkInData
  );

  return NextResponse.json({
    success: true,
    recommendations,
  });
}

async function handleValidate(data: Partial<OnboardingInput>) {
  const validation = validateOnboardingInput(data);

  return NextResponse.json({
    success: true,
    isValid: validation.isValid,
    missingFields: validation.missingFields,
  });
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'ai-onboarding',
    version: '1.0.0',
  });
}
