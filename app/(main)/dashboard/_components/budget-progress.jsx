"use client";

import { useState, useEffect } from "react";
import { Pencil, Check, X, Sparkles } from "lucide-react";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBudget } from "@/actions/budget";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BudgetProgress({ initialBudget, currentExpenses }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newBudget, setNewBudget] = useState(
    initialBudget?.amount?.toString() || ""
  );
  const [hasAlerted, setHasAlerted] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const {
    loading: isLoading,
    fn: updateBudgetFn,
    data: updatedBudget,
    error,
  } = useFetch(updateBudget);

  const percentUsed = initialBudget
    ? (currentExpenses / initialBudget.amount) * 100
    : 0;

  const handleUpdateBudget = async () => {
    const amount = parseFloat(newBudget);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    await updateBudgetFn(amount);
    setHasAlerted(false); // Reset alert when budget is updated
  };

  const handleCancel = () => {
    setNewBudget(initialBudget?.amount?.toString() || "");
    setIsEditing(false);
  };

  const moneySavingTips = [
    "Review recurring subscriptions and cancel unused services",
    "Cook meals at home instead of dining out",
    "Use public transportation or carpool to save on fuel",
    "Shop with a list to avoid impulse purchases",
    "Wait 24 hours before making non-essential purchases",
    "Compare prices online before major purchases",
    "Use energy-efficient appliances to reduce utility bills",
    "Buy generic brands for everyday items",
    "Plan your grocery shopping around sales and discounts",
    "Set up automatic transfers to savings account"
  ];

  useEffect(() => {
    if (updatedBudget?.success) {
      setIsEditing(false);
      toast.success("Budget updated successfully");
    }
  }, [updatedBudget]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to update budget");
    }
  }, [error]);

  // Budget alert effect
  useEffect(() => {
    if (initialBudget && percentUsed >= 80 && !hasAlerted) {
      if (percentUsed >= 90) {
        toast.warning(
          `Warning! You've used ${percentUsed.toFixed(
            1
          )}% of your budget. Consider reducing expenses.`,
          { duration: 10000 }
        );
      } else if (percentUsed >= 80) {
        toast.info(
          `Notice: You've used ${percentUsed.toFixed(
            1
          )}% of your budget. Be mindful of your spending.`,
          { duration: 8000 }
        );
      }
      setHasAlerted(true);
    }

    // Reset alert if spending goes below 80%
    if (percentUsed < 80 && hasAlerted) {
      setHasAlerted(false);
    }
  }, [percentUsed, initialBudget, hasAlerted]);

  return (
    <>
      {/* AI Insights Dialog */}
      <Dialog open={showInsights} onOpenChange={setShowInsights}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              AI-Powered Savings Insights
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Based on your current spending ({percentUsed.toFixed(1)}% of budget used), 
              here are personalized suggestions to help you save:
            </p>
            
            <ul className="space-y-3 list-disc pl-5">
              {moneySavingTips.map((tip, index) => (
                <li key={index} className="text-sm">{tip}</li>
              ))}
            </ul>
            
            <div className="flex justify-end pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowInsights(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget Progress Card */}
      <div className="space-y-4">
        {/* AI Insight Button - Only shows when budget exceeds 80% */}
        {initialBudget && percentUsed >= 80 && (
          <Button
            variant="outline"
            className="w-50 ml-auto bg-blue-800 text-white flex items-center gap-2"
            onClick={() => setShowInsights(true)}
          >
            <Sparkles className="h-4 w-4" />
            Get AI Insights to Save Money
          </Button>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex-1">
              <CardTitle className="text-sm font-medium">
                Monthly Budget (Default Account)
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={newBudget}
                      onChange={(e) => setNewBudget(e.target.value)}
                      className="w-32"
                      placeholder="Enter amount"
                      autoFocus
                      disabled={isLoading}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleUpdateBudget}
                      disabled={isLoading}
                    >
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCancel}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <CardDescription>
                      {initialBudget
                        ? `₹${currentExpenses.toFixed(
                            2
                          )} of ₹${initialBudget.amount.toFixed(2)} spent`
                        : "No budget set"}
                    </CardDescription>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsEditing(true)}
                      className="h-6 w-6"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {initialBudget && (
              <div className="space-y-2">
                <Progress
                  value={percentUsed}
                  extraStyles={`${
                    percentUsed >= 90
                      ? "bg-red-500"
                      : percentUsed >= 75
                        ? "bg-yellow-500"
                        : "bg-green-500"
                  }`}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {percentUsed.toFixed(1)}% used
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}