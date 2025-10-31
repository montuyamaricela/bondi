"use client"

import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"

interface UnmatchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  userName: string
  isLoading?: boolean
}

export function UnmatchModal({
  open,
  onOpenChange,
  onConfirm,
  userName,
  isLoading = false,
}: UnmatchModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-card border-border-main">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-error" />
            </div>
            <DialogTitle className="text-text-heading">
              Unmatch with {userName}?
            </DialogTitle>
          </div>
          <DialogDescription className="text-text-muted pt-4">
            This action cannot be undone. You will no longer be able to message
            each other, and this conversation will be archived.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="border-border-main text-text-body hover:bg-bg-hover"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-error hover:bg-error/90 text-white"
          >
            {isLoading ? "Unmatching..." : "Unmatch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
