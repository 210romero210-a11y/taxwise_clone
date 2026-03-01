"use client";

import React from "react";
import { AlertCircle, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { useBilingual } from "./BilingualProvider";

interface DiagnosticMessageProps {
  diagnostic: {
    fieldKey: string;
    message: string;
    severity: "Error" | "Warning" | "Info";
    instanceId?: string;
  };
  onJumpToField?: (fieldKey: string, instanceId?: string) => void;
}

export function DiagnosticMessage({ diagnostic, onJumpToField }: DiagnosticMessageProps) {
  const { t } = useBilingual();

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "Error":
        return {
          icon: AlertCircle,
          className: "bg-red-50 border-red-200 text-red-800",
          iconClassName: "text-red-500",
        };
      case "Warning":
        return {
          icon: AlertTriangle,
          className: "bg-amber-50 border-amber-200 text-amber-800",
          iconClassName: "text-amber-500",
        };
      default:
        return {
          icon: Info,
          className: "bg-blue-50 border-blue-200 text-blue-800",
          iconClassName: "text-blue-500",
        };
    }
  };

  const config = getSeverityConfig(diagnostic.severity);
  const Icon = config.icon;

  const handleClick = () => {
    if (onJumpToField) {
      onJumpToField(diagnostic.fieldKey, diagnostic.instanceId);
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${config.className} ${
        onJumpToField ? "cursor-pointer hover:opacity-90 transition-opacity" : ""
      }`}
      onClick={handleClick}
    >
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.iconClassName}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{diagnostic.message}</p>
        <p className="text-xs opacity-75 mt-1 font-mono">{diagnostic.fieldKey}</p>
      </div>
      {onJumpToField && (
        <ExternalLink className="w-4 h-4 mt-0.5 opacity-50" />
      )}
    </div>
  );
}

// Diagnostic List Component with Bilingual Support
interface DiagnosticListProps {
  diagnostics: Array<{
    fieldKey: string;
    message: string;
    severity: "Error" | "Warning" | "Info";
    instanceId?: string;
  }>;
  onJumpToField?: (fieldKey: string, instanceId?: string) => void;
}

export function DiagnosticList({ diagnostics, onJumpToField }: DiagnosticListProps) {
  if (diagnostics.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No issues found</p>
      </div>
    );
  }

  // Group by severity
  const errors = diagnostics.filter((d) => d.severity === "Error");
  const warnings = diagnostics.filter((d) => d.severity === "Warning");
  const infos = diagnostics.filter((d) => d.severity === "Info");

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-700 mb-2">
            Errors ({errors.length})
          </h3>
          <div className="space-y-2">
            {errors.map((d, i) => (
              <DiagnosticMessage
                key={`error-${i}`}
                diagnostic={d}
                onJumpToField={onJumpToField}
              />
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-700 mb-2">
            Warnings ({warnings.length})
          </h3>
          <div className="space-y-2">
            {warnings.map((d, i) => (
              <DiagnosticMessage
                key={`warning-${i}`}
                diagnostic={d}
                onJumpToField={onJumpToField}
              />
            ))}
          </div>
        </div>
      )}

      {infos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-blue-700 mb-2">
            Information ({infos.length})
          </h3>
          <div className="space-y-2">
            {infos.map((d, i) => (
              <DiagnosticMessage
                key={`info-${i}`}
                diagnostic={d}
                onJumpToField={onJumpToField}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
