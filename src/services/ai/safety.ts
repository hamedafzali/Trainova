// AI Safety Guardrails
// Implements safety checks and moderation for AI-generated content

export interface SafetyCheckResult {
  isSafe: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface SafetyConfig {
  enableMedicalDisclaimer: boolean;
  enablePIIFiltering: boolean;
  enableToxicityFiltering: boolean;
  enableHarmDetection: boolean;
}

const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  enableMedicalDisclaimer: true,
  enablePIIFiltering: true,
  enableToxicityFiltering: true,
  enableHarmDetection: true,
};

// Medical disclaimer that must be included in fitness-related AI responses
export const MEDICAL_DISCLAIMER = 
  "I'm an AI fitness assistant, not a doctor or medical professional. " +
  "This guidance is for informational purposes only and should not replace " +
  "professional medical advice. If you have health concerns or experience " +
  "chest pain, dizziness, or abnormal symptoms during exercise, stop immediately " +
  "and seek medical attention.";

// Patterns that might indicate PII (Personally Identifiable Information)
const PII_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
  /\b\d{1,5}\s+[A-Za-z]+\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi, // Addresses
];

// Harmful patterns that should be flagged
const HARMFUL_PATTERNS = [
  /starve|anorexia|bulimia|eating disorder/i,
  /steroid|performance enhancing drug|PED/i,
  /extreme.*deficit|crash diet/i,
  /no.*rest.*day|every.*day.*no.*break/i,
  /max.*effort.*daily|daily.*max/i,
  /ignore.*pain|push.*through.*pain/i,
];

/**
 * Check if content contains PII
 */
export function containsPII(content: string): boolean {
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if content contains harmful patterns
 */
export function containsHarmfulContent(content: string): boolean {
  for (const pattern of HARMFUL_PATTERNS) {
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}

/**
 * Add medical disclaimer to fitness-related content
 */
export function addMedicalDisclaimer(content: string, force: boolean = false): string {
  if (force || content.toLowerCase().includes('exercise') || 
      content.toLowerCase().includes('workout') ||
      content.toLowerCase().includes('training') ||
      content.toLowerCase().includes('fitness')) {
    return `${content}\n\n${MEDICAL_DISCLAIMER}`;
  }
  return content;
}

/**
 * Comprehensive safety check for AI-generated content
 */
export function performSafetyCheck(
  content: string,
  config: SafetyConfig = DEFAULT_SAFETY_CONFIG
): SafetyCheckResult {
  // Check for PII
  if (config.enablePIIFiltering && containsPII(content)) {
    return {
      isSafe: false,
      reason: 'Content contains personally identifiable information',
      severity: 'high',
    };
  }

  // Check for harmful content
  if (config.enableHarmDetection && containsHarmfulContent(content)) {
    return {
      isSafe: false,
      reason: 'Content contains potentially harmful fitness advice',
      severity: 'high',
    };
  }

  // Basic toxicity check (simplified - in production, use a proper toxicity detection service)
  if (config.enableToxicityFiltering) {
    const toxicWords = ['hate', 'kill', 'die', 'stupid', 'idiot'];
    const lowerContent = content.toLowerCase();
    for (const word of toxicWords) {
      if (lowerContent.includes(word)) {
        return {
          isSafe: false,
          reason: 'Content contains potentially toxic language',
          severity: 'medium',
        };
      }
    }
  }

  return {
    isSafe: true,
  };
}

/**
 * Sanitize content by removing detected PII
 */
export function sanitizeContent(content: string): string {
  let sanitized = content;
  
  for (const pattern of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  
  return sanitized;
}

/**
 * Validate user input for safety before processing
 */
export function validateUserInput(input: string): SafetyCheckResult {
  // Check for extremely long inputs (potential DoS)
  if (input.length > 10000) {
    return {
      isSafe: false,
      reason: 'Input exceeds maximum length',
      severity: 'low',
    };
  }

  // Check for injection attempts
  if (input.includes('ignore previous instructions') || 
      input.includes('forget everything') ||
      input.includes('new instructions:')) {
    return {
      isSafe: false,
      reason: 'Potential prompt injection detected',
      severity: 'high',
    };
  }

  return {
    isSafe: true,
  };
}
