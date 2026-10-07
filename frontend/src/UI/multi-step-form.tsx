"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const multiStepFormVariants = cva("flex w-full flex-col", {
  variants: {
    size: {
      default: "max-w-[700px]",
      sm: "max-w-[550px]",
      lg: "max-w-[850px]",
    },
  },
  defaultVariants: { size: "default" },
});

export interface MultiStepFormProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof multiStepFormVariants> {
  currentStep: number;
  totalSteps: number;
  /** Short names shown above the progress bar, e.g. ["Details", "Recipient", "Review"] */
  stepLabels?: string[];
  title: string;
  description: string;
  onBack: () => void;
  /** Called by the Next button and by pressing Enter inside a field (unless footerActions is set) */
  onNext: () => void;
  onClose?: () => void;
  backButtonText?: string;
  nextButtonText?: string;
  /** Disable Next until the step is valid */
  nextDisabled?: boolean;
  /** Show a spinner and block Next while saving / generating */
  nextLoading?: boolean;
  /** Replaces the Next button, e.g. Save + "Send via" on the final step. Also turns off Enter-to-submit. */
  footerActions?: React.ReactNode;
  footerContent?: React.ReactNode;
}

const MultiStepForm = React.forwardRef<HTMLDivElement, MultiStepFormProps>(
  (
    {
      className,
      size,
      currentStep,
      totalSteps,
      stepLabels,
      title,
      description,
      onBack,
      onNext,
      onClose,
      backButtonText = "Back",
      nextButtonText = "Next step",
      nextDisabled = false,
      nextLoading = false,
      footerActions,
      footerContent,
      children,
      ...props
    },
    ref
  ) => {
    const reduceMotion = useReducedMotion();
    const progress = Math.round((currentStep / totalSteps) * 100);

    // Slide in from the right when going forward, from the left when going back
    const previousStep = React.useRef(currentStep);
    const direction = currentStep >= previousStep.current ? 1 : -1;
    React.useEffect(() => {
      previousStep.current = currentStep;
    }, [currentStep]);

    const variants: Variants = {
      hidden: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : 40 * d }),
      enter: { opacity: 1, x: 0 },
      exit: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : -40 * d }),
    };

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      if (footerActions || nextDisabled || nextLoading) return;
      onNext();
    }

    const stepName = stepLabels?.[currentStep - 1];

    return (
      <Card ref={ref} className={cn(multiStepFormVariants({ size }), className)} {...props}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="gradient-text text-2xl font-bold tracking-tight">{title}</CardTitle>
            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <CardDescription>{description}</CardDescription>

          {stepLabels && stepLabels.length > 0 && (
            <ol className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs">
              {stepLabels.map((label, i) => (
                <li
                  key={label}
                  aria-current={i + 1 === currentStep ? "step" : undefined}
                  className={cn(
                    i + 1 === currentStep
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {i + 1}. {label}
                </li>
              ))}
            </ol>
          )}

          <div className="flex items-center gap-4 pt-2">
            <Progress value={progress} className="w-full" aria-label="Form progress" />
            <p className="whitespace-nowrap text-sm text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </p>
          </div>
          <p className="sr-only" aria-live="polite">
            Step {currentStep} of {totalSteps}
            {stepName ? `: ${stepName}` : ""}
          </p>
        </CardHeader>

        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="min-h-[320px] overflow-x-clip">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={variants}
                initial="hidden"
                animate="enter"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </CardContent>

          <CardFooter className="flex flex-wrap items-center justify-between gap-3">
            <div>{footerContent}</div>
            <div className="flex flex-wrap items-center gap-2">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={onBack} disabled={nextLoading}>
                  {backButtonText}
                </Button>
              )}
              {footerActions ?? (
                <Button type="submit" disabled={nextDisabled || nextLoading}>
                  {nextLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {nextButtonText}
                </Button>
              )}
            </div>
          </CardFooter>
        </form>
      </Card>
    );
  }
);

MultiStepForm.displayName = "MultiStepForm";

export { MultiStepForm };
