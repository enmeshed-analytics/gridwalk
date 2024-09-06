import React, { useState, useEffect } from "react";

const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="text-center py-1 px-6 bg-gray-200 dark:bg-gray-800 rounded-md shadow inline-block">
      <p className="text-sm font-medium">{time.toLocaleTimeString()}</p>
    </div>
  );
};

export default Clock;
