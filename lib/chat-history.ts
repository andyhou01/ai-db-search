import { Result } from "./types";

export interface ChatHistoryItem {
  id: string;
  query: string;
  sqlQuery: string;
  results: Result[];
  columns: string[];
  timestamp: number;
  connection: string;
}

// Maximum number of chat history items to store
const MAX_HISTORY_ITEMS = 20;

// Save a new chat history item to localStorage
export const saveChatHistory = (
  query: string,
  sqlQuery: string,
  results: Result[],
  columns: string[],
  connection: string
) => {
  try {
    // Get existing history
    const existingHistory = getChatHistory();

    // Create new history item
    const newItem: ChatHistoryItem = {
      id: generateId(),
      query,
      sqlQuery,
      results,
      columns,
      timestamp: Date.now(),
      connection,
    };

    // Add new item to the beginning of the array
    const updatedHistory = [newItem, ...existingHistory].slice(
      0,
      MAX_HISTORY_ITEMS
    );

    // Save to localStorage
    localStorage.setItem("chatHistory", JSON.stringify(updatedHistory));

    return newItem;
  } catch (error) {
    console.error("Failed to save chat history:", error);
    return null;
  }
};

// Get all chat history items from localStorage
export const getChatHistory = (): ChatHistoryItem[] => {
  try {
    const history = localStorage.getItem("chatHistory");
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error("Failed to retrieve chat history:", error);
    return [];
  }
};

// Clear all chat history
export const clearChatHistory = () => {
  try {
    localStorage.removeItem("chatHistory");
  } catch (error) {
    console.error("Failed to clear chat history:", error);
  }
};

// Generate a unique ID for each history item
const generateId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

// Add a new function to delete a specific history item
export const deleteHistoryItem = (id: string) => {
  try {
    const history = getChatHistory();
    const updatedHistory = history.filter((item) => item.id !== id);
    localStorage.setItem("chatHistory", JSON.stringify(updatedHistory));
    return updatedHistory;
  } catch (error) {
    console.error("Failed to delete history item:", error);
    return getChatHistory(); // Return current history if deletion fails
  }
};
