"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Clock, LogOut, RefreshCw } from "lucide-react";

// IRS Publication 1345 Session Constants
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const PREPARER_REAUTH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface SessionTimeoutModalProps {
  isPreparer?: boolean;
  onTimeout?: () => void;
  onRefresh?: () => void;
}

export function SessionTimeoutModal({ 
  isPreparer = false, 
  onTimeout, 
  onRefresh 
}: SessionTimeoutModalProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(INACTIVITY_TIMEOUT_MS / 1000);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Reset timer on user activity
  const resetTimer = useCallback(() => {
    setLastActivity(Date.now());
    setShowWarning(false);
    setTimeRemaining(INACTIVITY_TIMEOUT_MS / 1000);
  }, []);

  // Handle user activity
  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    
    const handleActivity = () => {
      const timeSinceLastActivity = Date.now() - lastActivity;
      
      // Check if we should show warning (2 minutes before timeout)
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT_MS - 2 * 60 * 1000) {
        setShowWarning(true);
      }
      
      // Reset if within timeout
      if (timeSinceLastActivity < INACTIVITY_TIMEOUT_MS) {
        resetTimer();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [lastActivity, resetTimer]);

  // Countdown timer
  useEffect(() => {
    if (!showWarning) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      const remaining = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
      
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        // Session timeout
        if (onTimeout) {
          onTimeout();
        } else {
          // Default behavior: dispatch event for cleanup then redirect
          window.dispatchEvent(new CustomEvent('session-timeout'));
          // Allow time for cleanup handlers before redirecting
          setTimeout(() => {
            window.location.href = "/api/auth/signout";
          }, 500);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [showWarning, lastActivity, onTimeout]);

  // Check for 12-hour preparer re-auth
  useEffect(() => {
    if (!isPreparer) return;

    const checkReauth = () => {
      const lastAuth = localStorage.getItem("taxwise_last_auth");
      if (lastAuth) {
        const elapsed = Date.now() - parseInt(lastAuth, 10);
        if (elapsed >= PREPARER_REAUTH_INTERVAL_MS) {
          // Force re-authentication
          if (onTimeout) {
            onTimeout();
          } else {
            window.location.href = "/api/auth/signout?reason=reauth_required";
          }
        }
      } else {
        localStorage.setItem("taxwise_last_auth", Date.now().toString());
      }
    };

    // Check on mount and every hour
    checkReauth();
    const interval = setInterval(checkReauth, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isPreparer, onTimeout]);

  const handleStayLoggedIn = () => {
    resetTimer();
    if (onRefresh) {
      onRefresh();
    }
  };

  if (!showWarning) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-100 rounded-full">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Session Expiring
            </h2>
            <p className="text-sm text-gray-500">
              IRS Publication 1345 requires session timeout
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-center text-3xl font-mono font-bold text-gray-900">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </p>
          <p className="text-center text-sm text-gray-500 mt-2">
            Time remaining before automatic logout
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              if (onTimeout) {
                onTimeout();
              } else {
                // Dispatch event for cleanup before redirect
                window.dispatchEvent(new CustomEvent('session-timeout'));
                setTimeout(() => {
                  window.location.href = "/api/auth/signout";
                }, 500);
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
          <button
            onClick={handleStayLoggedIn}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Stay Logged In
          </button>
        </div>

        {isPreparer && (
          <p className="text-xs text-gray-400 text-center mt-4">
            Professional preparers must re-authenticate every 12 hours per IRS regulations
          </p>
        )}
      </div>
    </div>
  );
}

// Session Status Indicator
export function SessionStatusIndicator({ 
  isPreparer = false 
}: { 
  isPreparer?: boolean 
}) {
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());
    const events = ["mousedown", "keydown", "scroll"];
    events.forEach((e) => window.addEventListener(e, updateActivity));
    return () => events.forEach((e) => window.removeEventListener(e, updateActivity));
  }, []);

  const timeSinceActivity = Date.now() - lastActivity;
  const percentageLeft = Math.max(0, 100 - (timeSinceActivity / INACTIVITY_TIMEOUT_MS) * 100);
  
  const getColor = () => {
    if (percentageLeft > 50) return "bg-green-500";
    if (percentageLeft > 20) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${getColor()}`}
          style={{ width: `${percentageLeft}%` }}
        />
      </div>
      <span>Session</span>
      {isPreparer && (
        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
          Prep
        </span>
      )}
    </div>
  );
}
