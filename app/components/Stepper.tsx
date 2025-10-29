import React, { useState, Children, HTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  onStepValidation?: (step: number) => Promise<boolean> | boolean;
  stepCircleContainerClassName?: string;
  stepContainerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  backButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  nextButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  backButtonText?: string;
  nextButtonText?: string;
  disableStepIndicators?: boolean;
  renderStepIndicator?: (props: {
    step: number;
    currentStep: number;
    onStepClick: (clicked: number) => void;
  }) => ReactNode;
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  onStepValidation,
  stepCircleContainerClassName = '',
  stepContainerClassName = '',
  contentClassName = '',
  footerClassName = '',
  backButtonProps = {},
  nextButtonProps = {},
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  disableStepIndicators = false,
  renderStepIndicator,
  ...rest
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep);
    if (newStep > totalSteps) {
      onFinalStepCompleted();
    } else {
      onStepChange(newStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      updateStep(currentStep - 1);
    }
  };

  const handleNext = async () => {
    if (!isLastStep) {
      // If validation function is provided, validate current step before proceeding
      if (onStepValidation) {
        try {
          const isValid = await onStepValidation(currentStep);
          if (!isValid) {
            return; // Don't proceed if validation fails
          }
        } catch (error) {
          console.error('Step validation error:', error);
          return; // Don't proceed if validation throws an error
        }
      }
      updateStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    updateStep(totalSteps + 1);
  };

  return (
    <div className='w-full' {...rest}>
      <div
        className={`mx-auto w-full max-w-4xl rounded-2xl shadow-lg border bg-bg-card border-border-main ${stepCircleContainerClassName}`}
      >
        <div
          className={`${stepContainerClassName} flex w-full items-center p-6`}
        >
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            const isNotLastStep = index < totalSteps - 1;
            return (
              <React.Fragment key={stepNumber}>
                {renderStepIndicator ? (
                  renderStepIndicator({
                    step: stepNumber,
                    currentStep,
                    onStepClick: (clicked) => {
                      updateStep(clicked);
                    },
                  })
                ) : (
                  <StepIndicator
                    step={stepNumber}
                    disableStepIndicators={disableStepIndicators}
                    currentStep={currentStep}
                    onClickStep={(clicked) => {
                      updateStep(clicked);
                    }}
                  />
                )}
                {isNotLastStep && (
                  <StepConnector isComplete={currentStep > stepNumber} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className={`space-y-2 px-6 ${contentClassName}`}>
          {!isCompleted && stepsArray[currentStep - 1]}
        </div>

        {!isCompleted && (
          <div className={`px-6 pb-6 ${footerClassName}`}>
            <div
              className={`mt-6 flex ${
                currentStep !== 1 ? 'justify-between' : 'justify-end'
              }`}
            >
              {currentStep !== 1 && (
                <button
                  type='button'
                  onClick={handleBack}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentStep === 1
                      ? 'pointer-events-none opacity-50 text-text-muted'
                      : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                  {...backButtonProps}
                >
                  {backButtonText}
                </button>
              )}
              <button
                type='button'
                onClick={isLastStep ? handleComplete : handleNext}
                className='px-6 py-2 cursor-pointer rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900'
                {...nextButtonProps}
              >
                {isLastStep ? 'Complete' : nextButtonText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StepProps {
  children: ReactNode;
}

export function Step({ children }: StepProps) {
  return <div className='px-6'>{children}</div>;
}

interface StepIndicatorProps {
  step: number;
  currentStep: number;
  onClickStep: (clicked: number) => void;
  disableStepIndicators?: boolean;
}

function StepIndicator({
  step,
  currentStep,
  onClickStep,
  disableStepIndicators = false,
}: StepIndicatorProps) {
  const status =
    currentStep === step
      ? 'active'
      : currentStep < step
      ? 'inactive'
      : 'complete';

  const handleClick = () => {
    if (step !== currentStep && !disableStepIndicators) {
      onClickStep(step);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative cursor-pointer outline-none focus:outline-none ${
        disableStepIndicators ? 'cursor-default' : 'hover:opacity-80'
      }`}
    >
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold transition-colors ${
          status === 'complete'
            ? 'bg-purple-600 text-white'
            : status === 'active'
            ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400'
            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
        }`}
      >
        {status === 'complete' ? (
          <Check className='h-4 w-4' />
        ) : status === 'active' ? (
          <div className='h-3 w-3 rounded-full bg-purple-600 dark:bg-purple-400' />
        ) : (
          <span className='text-sm'>{step}</span>
        )}
      </div>
    </div>
  );
}

interface StepConnectorProps {
  isComplete: boolean;
}

function StepConnector({ isComplete }: StepConnectorProps) {
  return (
    <div className='relative mx-2 h-0.5 flex-1 overflow-hidden rounded bg-gray-300 dark:bg-gray-600'>
      <div
        className={`absolute left-0 top-0 h-full transition-all duration-300 ${
          isComplete ? 'w-full bg-purple-600' : 'w-0 bg-transparent'
        }`}
      />
    </div>
  );
}
