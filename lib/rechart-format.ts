import { Config } from "./types";

type InputDataPoint = Record<string, string | number>;

interface TransformedDataPoint {
  [key: string]: string | number | null;
}

interface TransformationResult {
  data: TransformedDataPoint[];
  xAxisField: string;
  lineFields: string[];
}

export function transformDataForMultiLineChart(
  data: InputDataPoint[],
  chartConfig: Config
): TransformationResult {
  console.log("Input data for multi-line chart:", data);
  console.log("Chart config:", chartConfig);

  const { xKey, lineCategories, measurementColumn } = chartConfig;

  const fields = Object.keys(data[0]);
  console.log("Available fields:", fields);

  const xAxisField = xKey ?? "year"; // Assuming 'year' is always the x-axis

  // Find the field that contains the categorical values
  // Look for a field that contains any of the lineCategories values
  let lineField = "";
  if (lineCategories && lineCategories.length > 0) {
    for (const field of fields) {
      if (field !== xAxisField && field !== measurementColumn) {
        // Check if this field contains any of the expected categories
        const fieldValues = Array.from(
          new Set(data.map((item) => String(item[field])))
        );
        const hasMatchingCategories = lineCategories.some((category) =>
          fieldValues.includes(category)
        );
        if (hasMatchingCategories) {
          lineField = field;
          break;
        }
      }
    }
  }

  console.log("X-axis field:", xAxisField);
  console.log("Line field:", lineField);
  console.log("Line categories:", lineCategories);

  const xAxisValues = Array.from(
    new Set(data.map((item) => String(item[xAxisField])))
  );

  console.log("X-axis values:", xAxisValues);

  const transformedData: TransformedDataPoint[] = xAxisValues.map((xValue) => {
    const dataPoint: TransformedDataPoint = { [xAxisField]: xValue };
    lineCategories?.forEach((category) => {
      const matchingItem = data.find(
        (item) =>
          String(item[xAxisField]) === xValue &&
          String(item[lineField]) === category
      );
      dataPoint[category] = matchingItem
        ? matchingItem[measurementColumn ?? ""]
        : null;
    });
    return dataPoint;
  });

  transformedData.sort((a, b) => Number(a[xAxisField]) - Number(b[xAxisField]));

  console.log("Transformed data:", transformedData);
  console.log("Line fields for rendering:", lineCategories ?? []);

  return {
    data: transformedData,
    xAxisField,
    lineFields: lineCategories ?? [],
  };
}
