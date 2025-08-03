import { QueryExplanation } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

export function QueryWithTooltips({
  query,
  queryExplanations,
}: {
  query: string;
  queryExplanations: QueryExplanation[];
}) {
  const segments = segmentQuery(query, queryExplanations);

  return (
    <div className="relative">
      {/* SQL Query Container */}
      <div className="bg-slate-900 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 ml-2">
              SQL Query
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-500">
            Hover for explanations
          </span>
        </div>

        {/* Query Content */}
        <div className="p-4 overflow-x-auto">
          <pre className="font-mono text-sm leading-relaxed text-slate-100 dark:text-slate-200 whitespace-pre-wrap">
            {segments.map((segment, index) => (
              <span key={index}>
                {segment.explanation ? (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block bg-blue-500/20 hover:bg-blue-500/30 border-b-2 border-blue-400/50 hover:border-blue-400 transition-all duration-200 ease-in-out rounded-sm px-1 py-0.5 cursor-help text-blue-100 hover:text-white">
                          {segment.text}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        avoidCollisions={true}
                        className="max-w-md font-sans bg-slate-900 border-slate-700 text-slate-100 shadow-xl"
                        sideOffset={8}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">
                              SQL Explanation
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed text-slate-200">
                            {segment.explanation}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <span className="text-slate-300 dark:text-slate-400">
                    {segment.text}
                  </span>
                )}
              </span>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

function segmentQuery(
  query: string,
  explanations: QueryExplanation[]
): Array<{ text: string; explanation?: string }> {
  const segments: Array<{ text: string; explanation?: string }> = [];
  let lastIndex = 0;

  // Sort explanations by their position in the query
  const sortedExplanations = explanations
    .map((exp) => ({ ...exp, index: query.indexOf(exp.section) }))
    .filter((exp) => exp.index !== -1)
    .sort((a, b) => a.index - b.index);

  sortedExplanations.forEach((exp) => {
    if (exp.index > lastIndex) {
      // Add any text before the current explanation as a segment without explanation
      segments.push({ text: query.slice(lastIndex, exp.index) });
    }
    segments.push({ text: exp.section, explanation: exp.explanation });
    lastIndex = exp.index + exp.section.length;
  });

  // Add any remaining text after the last explanation
  if (lastIndex < query.length) {
    segments.push({ text: query.slice(lastIndex) });
  }

  return segments;
}
