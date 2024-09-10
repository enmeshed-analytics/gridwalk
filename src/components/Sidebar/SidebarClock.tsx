"use client";

import React, { useState, useEffect } from "react";

const Clock: React.FC = () => {
  const [time, setTime] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString());
    };

    updateTime(); // Set initial time
    const timer = setInterval(updateTime, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="text-center py-1 px-6 bg-gray-200 dark:bg-gray-800 rounded-md shadow inline-block">
      <p className="text-sm font-medium">{time}</p>
    </div>
  );
};

export default Clock;
