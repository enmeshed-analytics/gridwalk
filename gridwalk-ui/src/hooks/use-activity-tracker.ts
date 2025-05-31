import { useEffect, useRef, useState } from "react";

interface ActivityData {
  lastActive: Date;
  email: string;
}

// TODO: This is a hack to get the last active time of a user. It is not very accurate and is not a good solution.
// Needs to be improved - when the backend is refactored.
export function useActivityTracker(userEmail: string) {
  const [lastActive, setLastActive] = useState<Date>(new Date());
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Load saved activity on mount
    const saved = localStorage.getItem(`activity-${userEmail}`);
    if (saved) {
      try {
        const data: ActivityData = JSON.parse(saved);
        setLastActive(new Date(data.lastActive));
      } catch (error) {
        console.error("Failed to parse saved activity:", error);
      }
    }

    const updateActivity = () => {
      const now = new Date();
      setLastActive(now);

      // Store in localStorage for persistence
      const activityData: ActivityData = {
        lastActive: now,
        email: userEmail,
      };
      localStorage.setItem(
        `activity-${userEmail}`,
        JSON.stringify(activityData)
      );
    };

    // Activity detection events
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    const handleActivity = () => {
      // Debounce activity updates
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(updateActivity, 1000);
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    // Page visibility change detection
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateActivity();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initial activity update
    updateActivity();

    return () => {
      // Cleanup
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [userEmail]);

  return lastActive;
}
