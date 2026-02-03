import { useState } from 'react';
import type { CreateBotInput } from '../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { WizardProvider, useWizard } from './context/WizardContext';
import { WizardProgress } from './WizardProgress';
import { Page1Templates, Page2Personality, Page3Toggles, Page4Config, Page5Summary } from './pages';
import './CreateWizard.css';

interface CreateWizardProps {
  onClose: () => void;
  onSubmit: (input: CreateBotInput) => Promise<void>;
}

const STEPS = ['Template', 'Personality', 'Features', 'Configure', 'Review'];

function WizardContent({ onClose, onSubmit }: CreateWizardProps) {
  const { validate, buildInput } = useWizard();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleNext = () => {
    const result = validate(step);
    if (!result.valid) {
      setError(result.error ?? 'Validation failed');
      return;
    }
    setError('');
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
    setError('');
  };

  const handleSubmit = async () => {
    const result = validate(step);
    if (!result.valid) {
      setError(result.error ?? 'Validation failed');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const input = buildInput();
      await onSubmit(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bot');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return <Page1Templates />;
      case 1:
        return <Page2Personality />;
      case 2:
        return <Page3Toggles />;
      case 3:
        return <Page4Config />;
      case 4:
        return <Page5Summary />;
      default:
        return null;
    }
  };

  const footer = (
    <>
      <Button
        variant="ghost"
        onClick={handleBack}
        disabled={step === 0 || submitting}
      >
        Back
      </Button>
      {step < STEPS.length - 1 ? (
        <Button variant="primary" onClick={handleNext}>
          Next
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={() => { void handleSubmit(); }}
          loading={submitting}
        >
          Create Bot
        </Button>
      )}
    </>
  );

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Bot" footer={footer} size="lg">
      <WizardProgress steps={STEPS} currentStep={step} />
      {error && (
        <div className="wizard-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4h2v5H7V4zm0 6h2v2H7v-2z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      <div className="wizard-step-content">
        {renderStepContent()}
      </div>
    </Modal>
  );
}

export function CreateWizard(props: CreateWizardProps) {
  return (
    <WizardProvider>
      <WizardContent {...props} />
    </WizardProvider>
  );
}
