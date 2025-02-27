"use client";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const HistoryPage = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const formatDate = (datetimeStr: string) => {
    const year = parseInt(datetimeStr.slice(0, 4));
    const month = parseInt(datetimeStr.slice(4, 6));
    const day = parseInt(datetimeStr.slice(6, 8));
    const hours = parseInt(datetimeStr.slice(9, 11));
    const minutes = parseInt(datetimeStr.slice(11, 13));
    const seconds = parseInt(datetimeStr.slice(13, 15));
    const utcDate = new Date(
      Date.UTC(year, month - 1, day, hours, minutes, seconds)
    );

    const localDate = new Date(utcDate);
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
      // timeZoneName: "short",
    };

    // return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    return localDate.toLocaleString(undefined, options);
  };

  useEffect(() => {
    // Fetch tasks from Flask API
    const fetchTasks = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/tasks`,
          {
            method: "POST",
          }
        );
        let data = await response.json();

        data = data.sort(
          (a: any, b: any) =>
            new Date(formatDate(b.datetime)).getTime() -
            new Date(formatDate(a.datetime)).getTime()
        );

        data = data.map((item: any, index: number) => {
          const formattedDate = formatDate(item.datetime);

          const accuracy = ((1 - item.mape) * 100).toFixed(2);

          return {
            id: index + 1,
            ...item,
            trained_time: formattedDate,
            accuracy: `${accuracy}%`,
          };
        });

        setTasks(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  const columns = [
    {
      Header: "ID",
      accessor: "id",
    },
    {
      Header: "Query Time",
      accessor: "query_time",
    },
    {
      Header: "Data Base",
      accessor: "data_base",
    },
    {
      Header: "Result Size",
      accessor: "result_size",
    },
    {
      Header: "Actions",
      accessor: "actions",
    },
  ];

  const tableColumns = columns.map((col) => ({
    accessorKey: col.accessor,
    header: ({ column }: any) => {
      return col.accessor === "actions" ? (
        <div className="p-1 font-semibold text-primary font-lg">
          {col.Header}
        </div>
      ) : (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-1 font-semibold text-primary font-lg hover:bg-primary/10"
        >
          {col.Header}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </Button>
      );
    },
    cell:
      col.accessor === "actions"
        ? ({ row }: any) => (
            <button
              onClick={() => handleActionClick(row.original.task_id)}
              className="underline text-secondary hover:text-blue-600 underline-offset-2"
            >
              View Details
            </button>
          )
        : ({ row }: any) => row.original[col.accessor],
  }));

  const handleActionClick = (taskId: string) => {
    router.push(`/dashboard/${taskId}`);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mt-2 mb-8">
        <h1 className="text-2xl font-bold">Query History</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore and manage all your queries in one place
        </p>
      </div>
      <DataTable
        columns={tableColumns}
        data={tasks}
        pageSize={10}
        tableSummary={
          <div className="py-[0.4rem] rounded-sm px-4 bg-muted flex w-full">
            {" "}
            Totally{" "}
            <span className="px-2 font-semibold text-primary">
              {tasks.length}
            </span>{" "}
            trained models
          </div>
        }
      />
    </div>
  );
};
export default HistoryPage;
