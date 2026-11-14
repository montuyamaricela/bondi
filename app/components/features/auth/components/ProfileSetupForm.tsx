'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from '@/lib/session';
import { profileSetupSchema } from '../validation';
import type { ProfileSetupFormData, ProfileStep } from '../types';
import { getFieldsToValidate } from '../types';
import { Form } from '@/app/components/ui/form';
import { FetchError } from '@/lib/fetch-wrapper';
import { useProfileSetupMutation } from '@/lib/client/profile';
import Stepper, { Step } from '@/app/components/ui/custom/stepper/Stepper';
import { useLocalStorage } from '@/app/components/hooks/useLocalStorage';
import { toast } from 'sonner';
import { SuccessModal } from '@/app/components/ui/custom/SuccessModal';
import { BasicInformationStep } from './BasicInformationStep';
import { InterestsHobbiesStep } from './InterestsHobbiesStep';
import { DatingPreferencesStep } from './DatingPreferencesStep';

export function ProfileSetupForm() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const profileSetupMutation = useProfileSetupMutation();
  const { data: session, isPending: isSessionLoading, error: sessionError } = useSession();

  const [savedFormData, setSavedFormData, clearSavedFormData] = useLocalStorage<
    Partial<ProfileSetupFormData>
  >('profile-setup-form', {}, 10);

  const [uploadedImage, setUploadedImage] = useState<string | null>(
    savedFormData.profileImage || null,
  );

  const form = useForm<ProfileSetupFormData>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      name: savedFormData.name || '',
      age: savedFormData.age || 18,
      bio: savedFormData.bio || '',
      gender: savedFormData.gender || 'FEMALE',
      location: savedFormData.location || '',
      interests: savedFormData.interests || [],
      hobbies: savedFormData.hobbies || [],
      lookingFor: savedFormData.lookingFor || '',
      relationshipType: savedFormData.relationshipType || 'CASUAL',
      genderPreference: savedFormData.genderPreference || 'EVERYONE',
      profileImage: savedFormData.profileImage || undefined,
    },
  });

  useEffect(() => {
    if (session?.user?.name && !savedFormData.name) {
      form.setValue('name', session.user.name);
    }
  }, [session, form, savedFormData.name]);

  useEffect(() => {
    return form.subscribe({
      formState: { values: true },
      callback: ({ values: formData }) => {
        setSavedFormData({
          ...formData,
          profileImage: uploadedImage || '',
          interests:
            formData.interests?.filter((interest): interest is string => interest !== undefined) ||
            [],
          hobbies: formData.hobbies?.filter((hobby): hobby is string => hobby !== undefined) || [],
        });
      },
    });
  }, [form, setSavedFormData, uploadedImage]);

  const validateStep = async (step: number): Promise<boolean> => {
    const formData = form.getValues();
    const dataToValidate = {
      ...formData,
      profileImage: uploadedImage || undefined,
    };

    try {
      const fieldsToValidate = getFieldsToValidate(step as ProfileStep);

      const stepSchema = profileSetupSchema.pick(
        Object.fromEntries(fieldsToValidate.map((field) => [field, true as const])),
      );

      stepSchema.parse(dataToValidate);
      return true;
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        const zodError = error as { issues?: Array<{ message: string }> };
        const firstError = zodError.issues?.[0];
        if (firstError) {
          toast.error(firstError.message);
        }
      }
      return false;
    }
  };

  const onSubmit = async (data: ProfileSetupFormData) => {
    setApiError(null);

    const dataToSubmit = {
      ...data,
      profileImage: uploadedImage || undefined,
    };

    try {
      const result = await profileSetupMutation.mutateAsync(dataToSubmit);

      if (result.success) {
        clearSavedFormData();

        setShowSuccessModal(true);

        setTimeout(() => {
          router.push('/discover');
        }, 2500);
      } else {
        const errorMsg = result.error || 'Failed to create profile';
        console.error('❌ Profile creation failed:', errorMsg);
        setApiError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('💥 Error during submission:', error);

      if (error instanceof FetchError) {
        const errorMsg = error.message;
        console.error('🌐 Fetch error:', errorMsg);
        setApiError(errorMsg);
        toast.error(errorMsg);
      } else {
        const errorMsg = 'An unexpected error occurred. Please try again.';
        console.error('⚠️ Unexpected error:', error);
        setApiError(errorMsg);
        toast.error(errorMsg);
      }
    }
  };

  if (isSessionLoading) {
    return (
      <div className="w-full space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="w-full space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-error">
            {sessionError ? 'Failed to load session' : 'No session found'}
          </p>
          <p className="text-text-muted">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8 space-y-2 text-center">
        <h2 className="text-3xl font-bold text-text-heading">Complete your profile</h2>
        <p className="text-text-muted">Tell us about yourself to get started</p>
      </div>

      {apiError && (
        <div className="mb-6 rounded-lg border border-error bg-error-light p-4">
          <p className="text-sm text-error">{apiError}</p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
          <Stepper
            initialStep={1}
            onStepValidation={validateStep}
            onFinalStepCompleted={() => {
              form.handleSubmit(
                (data) => {
                  onSubmit(data);
                },
                (errors) => {
                  console.error('❌ Form validation failed:', errors);
                  const firstError = Object.values(errors)[0]?.message;
                  if (firstError) {
                    toast.error(firstError);
                  }
                },
              )();
            }}
            stepCircleContainerClassName="bg-bg-card border-border-main"
            contentClassName="py-8"
            footerClassName="border-t border-border-main"
          >
            <Step>
              <BasicInformationStep
                form={form}
                uploadedImage={uploadedImage}
                setUploadedImage={setUploadedImage}
                setApiError={setApiError}
                setSavedFormData={setSavedFormData}
              />
            </Step>

            <Step>
              <InterestsHobbiesStep form={form} />
            </Step>

            <Step>
              <DatingPreferencesStep form={form} />
            </Step>
          </Stepper>
        </form>
      </Form>

      <SuccessModal
        isOpen={showSuccessModal}
        title="Profile Created!"
        message="Your profile has been created successfully. Redirecting to discover..."
      />
    </div>
  );
}
