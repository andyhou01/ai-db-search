"use client";

import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Config, Result } from "@/lib/types";
import { Label } from "recharts";
import { transformDataForMultiLineChart } from "@/lib/rechart-format";
import { isDateLike, formatDateForChart } from "@/lib/utils";

function toTitleCase(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
const colors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
];

export function DynamicChart({
  chartData,
  chartConfig,
}: {
  chartData: Result[];
  chartConfig: Config;
}) {
  const renderChart = () => {
    if (!chartData || !chartConfig) return <div>No chart data</div>;

    // Ensure yKeys exists and is an array
    if (
      !chartConfig.yKeys ||
      !Array.isArray(chartConfig.yKeys) ||
      chartConfig.yKeys.length === 0
    ) {
      console.error("Chart config missing yKeys:", chartConfig);
      return <div>Invalid chart configuration: missing yKeys</div>;
    }

    // Ensure xKey exists
    if (!chartConfig.xKey) {
      console.error("Chart config missing xKey:", chartConfig);
      return <div>Invalid chart configuration: missing xKey</div>;
    }

    const parsedChartData = chartData.map((item) => {
      const parsedItem: { [key: string]: any } = {};
      for (const [key, value] of Object.entries(item)) {
        if (key === chartConfig.xKey) {
          // Always check and format x-axis values for better chart display
          if (isDateLike(value)) {
            // Format the x-axis value if it's a date
            const formattedValue = formatDateForChart(value);
            parsedItem[key] = formattedValue;
            parsedItem[`${key}_original`] = value; // Keep original for sorting if needed

            // Debug logging
            if (formattedValue !== String(value)) {
              console.log(
                `Formatted x-axis date: ${value} -> ${formattedValue}`
              );
            }
          } else {
            parsedItem[key] = value;
          }
        } else {
          // For non-x-axis values, convert numbers appropriately
          parsedItem[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
      return parsedItem;
    });

    chartData = parsedChartData;

    // Sort data by x-axis if it contains dates to ensure proper chronological order
    if (chartData.length > 0 && chartData[0][`${chartConfig.xKey}_original`]) {
      chartData.sort((a, b) => {
        const aValue = a[`${chartConfig.xKey}_original`];
        const bValue = b[`${chartConfig.xKey}_original`];

        // Handle numeric timestamps
        if (typeof aValue === "number" && typeof bValue === "number") {
          return aValue - bValue;
        }

        // Handle string timestamps or dates
        if (typeof aValue === "string" && typeof bValue === "string") {
          const aNum = parseInt(aValue);
          const bNum = parseInt(bValue);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }
          // Fall back to date parsing
          return new Date(aValue).getTime() - new Date(bValue).getTime();
        }

        return 0;
      });
    }

    const processChartData = (data: Result[], chartType: string) => {
      if (chartType === "bar" || chartType === "pie") {
        if (data.length <= 8) {
          return data;
        }

        const subset = data.slice(0, 20);
        return subset;
      }
      return data;
    };

    chartData = processChartData(chartData, chartConfig.type);
    // console.log({ chartData, chartConfig });

    switch (chartConfig.type) {
      case "bar":
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={chartConfig.xKey}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            >
              <Label
                value={toTitleCase(chartConfig.xKey)}
                offset={-5}
                position="insideBottom"
              />
            </XAxis>
            <YAxis>
              <Label
                value={toTitleCase(chartConfig.yKeys[0])}
                angle={-90}
                position="insideLeft"
              />
            </YAxis>
            <ChartTooltip content={<ChartTooltipContent />} />
            {chartConfig.legend && <Legend />}
            {chartConfig.yKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
              />
            ))}
          </BarChart>
        );
      case "line":
        const { data, xAxisField, lineFields } = transformDataForMultiLineChart(
          chartData,
          chartConfig
        );
        const useTransformedData =
          chartConfig.multipleLines &&
          chartConfig.measurementColumn &&
          chartConfig.yKeys.includes(chartConfig.measurementColumn);

        // Custom tick formatter for dates
        const formatXAxisTick = (value: any) => {
          // If the value looks like a formatted date already, return it
          if (
            typeof value === "string" &&
            /\d{1,2}\/\d{1,2}\/\d{4}/.test(value)
          ) {
            return value;
          }
          return value;
        };

        return (
          <LineChart data={useTransformedData ? data : chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={useTransformedData ? chartConfig.xKey : chartConfig.xKey}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
              tickFormatter={formatXAxisTick}
            >
              <Label
                value={toTitleCase(
                  useTransformedData ? xAxisField : chartConfig.xKey
                )}
                offset={-5}
                position="insideBottom"
              />
            </XAxis>
            <YAxis>
              <Label
                value={toTitleCase(chartConfig.yKeys[0])}
                angle={-90}
                position="insideLeft"
              />
            </YAxis>
            <ChartTooltip content={<ChartTooltipContent />} />
            {chartConfig.legend && <Legend />}
            {useTransformedData
              ? lineFields.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                  />
                ))
              : chartConfig.yKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                  />
                ))}
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={chartConfig.xKey}
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            {chartConfig.legend && <Legend />}
            {chartConfig.yKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                fill={colors[index % colors.length]}
                stroke={colors[index % colors.length]}
              />
            ))}
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart>
            <Pie
              data={chartData}
              dataKey={chartConfig.yKeys[0]}
              nameKey={chartConfig.xKey}
              cx="50%"
              cy="50%"
              outerRadius={120}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
            {chartConfig.legend && <Legend />}
          </PieChart>
        );
      default:
        return <div>Unsupported chart type: {chartConfig.type}</div>;
    }
  };

  return (
    <div className="w-full flex flex-col justify-center items-center">
      <h2 className="text-lg font-bold mb-2">{chartConfig.title}</h2>
      {chartConfig && chartData.length > 0 && (
        <ChartContainer
          config={
            chartConfig.yKeys && chartConfig.yKeys.length > 0
              ? chartConfig.yKeys.reduce((acc, key, index) => {
                  acc[key] = {
                    label: key,
                    color: colors[index % colors.length],
                  };
                  return acc;
                }, {} as Record<string, { label: string; color: string }>)
              : {} // Fallback to empty config if yKeys is undefined
          }
          className="h-[320px] w-full"
        >
          {renderChart()}
        </ChartContainer>
      )}
      <div className="w-full">
        <p className="mt-4 text-sm">{chartConfig.description}</p>
        <p className="mt-4 text-sm">{chartConfig.takeaway}</p>
      </div>
    </div>
  );
}
