"use client";
import React, { useEffect, useRef, JSX } from "react";

interface Block {
  baseX: number;
  baseY: number;
  baseZ: number;
  x: number;
  y: number;
  z: number;
  size: number;
  duration: number;
  delay: number;
  phase: number;
}

export default function GridBackground(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };

    const getRoomSize = () => {
      const diagonal = Math.sqrt(
        Math.pow(window.innerWidth, 2) + Math.pow(window.innerHeight, 2),
      );
      return diagonal;
    };

    const getPerspective = () => {
      return getRoomSize() * 0.8;
    };

    const roomSize = getRoomSize() * 0.5;
    const blocks: Block[] = Array.from({ length: 150 }, () => {
      const baseX = (Math.random() - 0.5) * roomSize * 2;
      const baseY = (Math.random() - 0.5) * roomSize * 2;
      const baseZ = (Math.random() - 0.5) * roomSize * 2;

      return {
        baseX,
        baseY,
        baseZ,
        x: baseX,
        y: baseY,
        z: baseZ,
        size: Math.random() * 40 + 10,
        duration: Math.random() * 10 + 15,
        delay: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
      };
    });

    const project = (x: number, y: number, z: number) => {
      const perspective = getPerspective();
      const scale = perspective / (perspective + z);
      return {
        x: x * scale + window.innerWidth / 2,
        y: y * scale + window.innerHeight / 2,
        scale,
      };
    };

    const drawGridPlane = (
      points: [number, number, number][],
      color: string = "rgba(59, 130, 246, 0.2)",
    ) => {
      const minDimension = Math.min(window.innerWidth, window.innerHeight);
      const cellSize = minDimension / 20;
      const gridSize = Math.ceil((getRoomSize() / cellSize) * 2);

      for (let i = 0; i <= gridSize; i++) {
        const x = (i / gridSize) * (points[1][0] - points[0][0]) + points[0][0];
        const y1 = points[0][1];
        const z1 = points[0][2];
        const y2 = points[2][1];
        const z2 = points[2][2];

        const start = project(x, y1, z1);
        const end = project(x, y2, z2);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = color;
        ctx.stroke();
      }

      for (let i = 0; i <= gridSize; i++) {
        const y = (i / gridSize) * (points[2][1] - points[0][1]) + points[0][1];
        const x1 = points[0][0];
        const z1 = points[0][2];
        const x2 = points[1][0];
        const z2 = points[1][2];

        const start = project(x1, y, z1);
        const end = project(x2, y, z2);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = color;
        ctx.stroke();
      }
    };

    const drawBlock = (block: Block) => {
      const projected = project(block.x, block.y, block.z);
      const size = block.size * projected.scale;

      if (size > 1) {
        ctx.save();
        ctx.translate(projected.x, projected.y);

        const gradient = ctx.createLinearGradient(
          -size / 2,
          -size / 2,
          size / 2,
          size / 2,
        );
        gradient.addColorStop(
          0,
          `rgba(59, 130, 246, ${0.3 * projected.scale})`,
        );
        gradient.addColorStop(1, `rgba(30, 64, 175, ${0.3 * projected.scale})`);

        ctx.beginPath();
        ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.2);

        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.restore();
      }
    };

    const updateBlocks = (time: number) => {
      blocks.forEach((block) => {
        const t = (time * 0.001) / block.duration + block.delay;
        const moveRange = 900;

        block.x = block.baseX + Math.sin(t) * moveRange;
        block.y = block.baseY + Math.sin(t * 0.8 + block.phase) * moveRange;
        block.z =
          block.baseZ + Math.sin(t * 0.5 + block.phase * 2) * (moveRange * 0.5);
      });
    };

    const draw = (time: number) => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const roomSize = getRoomSize();
      const offset = roomSize * 0.2;

      const floorPoints: [number, number, number][] = [
        [-roomSize - offset, roomSize, -roomSize - offset],
        [roomSize + offset, roomSize, -roomSize - offset],
        [-roomSize - offset, roomSize, roomSize + offset],
        [roomSize + offset, roomSize, roomSize + offset],
      ];

      const leftWallPoints: [number, number, number][] = [
        [-roomSize - offset, roomSize, -roomSize - offset],
        [-roomSize - offset, roomSize, roomSize + offset],
        [-roomSize - offset, -roomSize, -roomSize - offset],
        [-roomSize - offset, -roomSize, roomSize + offset],
      ];

      const rightWallPoints: [number, number, number][] = [
        [roomSize + offset, roomSize, -roomSize - offset],
        [roomSize + offset, roomSize, roomSize + offset],
        [roomSize + offset, -roomSize, -roomSize - offset],
        [roomSize + offset, -roomSize, roomSize + offset],
      ];

      const backWallPoints: [number, number, number][] = [
        [-roomSize - offset, roomSize, -roomSize - offset],
        [roomSize + offset, roomSize, -roomSize - offset],
        [-roomSize - offset, -roomSize, -roomSize - offset],
        [roomSize + offset, -roomSize, -roomSize - offset],
      ];

      ctx.lineWidth = 0.5;
      drawGridPlane(floorPoints, "rgba(59, 130, 246, 0.3)");
      drawGridPlane(leftWallPoints, "rgba(59, 130, 246, 0.15)");
      drawGridPlane(rightWallPoints, "rgba(59, 130, 246, 0.15)");
      drawGridPlane(backWallPoints, "rgba(59, 130, 246, 0.15)");

      updateBlocks(time);
      blocks.sort((a, b) => b.z - a.z);
      blocks.forEach((block) => drawBlock(block));
    };

    let animationFrameId: number;
    const animate = (time: number) => {
      draw(time);
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      updateCanvasSize();
    };

    updateCanvasSize();
    window.addEventListener("resize", handleResize);
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    />
  );
}
