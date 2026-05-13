"use client";

import { RocketIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const stars = [
  { top: "8%", left: "10%", size: 2, delay: 0.2, duration: 2.6 },
  { top: "16%", left: "26%", size: 3, delay: 1.1, duration: 3.2 },
  { top: "23%", left: "71%", size: 2, delay: 0.8, duration: 2.9 },
  { top: "31%", left: "53%", size: 4, delay: 1.7, duration: 3.8 },
  { top: "42%", left: "14%", size: 2, delay: 0.5, duration: 2.4 },
  { top: "55%", left: "82%", size: 3, delay: 1.4, duration: 3.4 },
  { top: "64%", left: "38%", size: 2, delay: 0.9, duration: 3.1 },
  { top: "76%", left: "62%", size: 3, delay: 1.8, duration: 2.7 },
  { top: "84%", left: "18%", size: 2, delay: 1.2, duration: 2.5 },
  { top: "12%", left: "88%", size: 2, delay: 1.6, duration: 3.3 },
] as const;

const shootingStars = [
  { top: "14%", left: "68%", rotate: -18, delay: 0.4, duration: 5.5 },
  { top: "38%", left: "84%", rotate: -24, delay: 2.5, duration: 6.6 },
  { top: "58%", left: "60%", rotate: -16, delay: 4.1, duration: 5.8 },
] as const;

const rockets = [
  {
    top: "18%",
    size: "lg",
    delay: 1.2,
    duration: 28,
    y: [0, -16, 6, 0],
    rotate: [-8, -6, -10, -8],
    opacity: 0.4,
  },
  {
    top: "52%",
    size: "md",
    delay: 6.5,
    duration: 22,
    y: [0, 10, -8, 0],
    rotate: [10, 7, 12, 10],
    opacity: 0.28,
  },
  {
    top: "78%",
    size: "sm",
    delay: 10,
    duration: 18,
    y: [0, -10, 8, 0],
    rotate: [-4, -2, -6, -4],
    opacity: 0.22,
  },
] as const;

function RocketTrail(props: {
  top: string;
  size: "sm" | "md" | "lg";
  delay: number;
  duration: number;
  y: readonly number[];
  rotate: readonly number[];
  opacity: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const sizeClasses = {
    sm: "h-7 w-7",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  } as const;

  return (
    <motion.div
      className="absolute left-[-10%]"
      style={{ top: props.top, opacity: props.opacity }}
      initial={{ x: "-8vw" }}
      animate={
        prefersReducedMotion
          ? undefined
          : {
              x: ["0vw", "40vw", "78vw", "118vw"],
              y: [...props.y],
              rotate: [...props.rotate],
            }
      }
      transition={
        prefersReducedMotion
          ? undefined
          : {
              duration: props.duration,
              delay: props.delay,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }
      }
    >
      <div className="relative">
        <div className="absolute left-[-72px] top-1/2 h-px w-20 -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-300/30 to-cyan-100/70 blur-[1px]" />
        <div className="absolute left-[-40px] top-1/2 h-2 w-10 -translate-y-1/2 rounded-full bg-cyan-200/18 blur-md" />
        <div className="rounded-full border border-cyan-300/25 bg-slate-950/40 p-2 shadow-[0_0_28px_rgba(34,211,238,0.12)] backdrop-blur-sm">
          <RocketIcon className={`${sizeClasses[props.size]} text-cyan-100`} />
        </div>
      </div>
    </motion.div>
  );
}

export function AdminGalaxyScene() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 admin-galaxy-grid opacity-40" />
      <motion.div
        className="absolute inset-y-0 left-[-12%] w-[38%] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.16),transparent_62%)] blur-3xl"
        animate={
          prefersReducedMotion
            ? undefined
            : { x: [0, 60, -20, 0], opacity: [0.45, 0.65, 0.5, 0.45] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
        }
      />
      <motion.div
        className="absolute right-[-10%] top-[8%] h-[46%] w-[34%] bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.16),transparent_62%)] blur-3xl"
        animate={
          prefersReducedMotion
            ? undefined
            : { x: [0, -55, 10, 0], y: [0, 20, -10, 0], opacity: [0.35, 0.55, 0.4, 0.35] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 24, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
        }
      />
      <motion.div
        className="absolute bottom-[-6%] left-[22%] h-[30%] w-[46%] bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.14),transparent_66%)] blur-3xl"
        animate={
          prefersReducedMotion
            ? undefined
            : { x: [0, -40, 20, 0], y: [0, -18, 8, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 26, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
        }
      />
      <div className="absolute -left-32 top-8 h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(80,170,255,0.18),_transparent_70%)] blur-3xl" />
      <div className="absolute right-[-7rem] top-1/4 h-96 w-96 rounded-full bg-[radial-gradient(circle,_rgba(180,85,255,0.16),_transparent_68%)] blur-3xl" />
      <div className="absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(82,245,230,0.14),_transparent_72%)] blur-3xl" />

      {stars.map((star, index) => (
        <motion.span
          key={`${star.top}-${star.left}-${index}`}
          className="absolute rounded-full bg-white/90 shadow-[0_0_14px_rgba(255,255,255,0.65)]"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
          }}
          animate={
            prefersReducedMotion
              ? undefined
              : { opacity: [0.25, 1, 0.35], scale: [1, 1.8, 1] }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : {
                  duration: star.duration,
                  delay: star.delay,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }
          }
        />
      ))}

      {shootingStars.map((star, index) => (
        <motion.span
          key={`${star.top}-${star.left}-${index}`}
          className="absolute h-px w-28 bg-gradient-to-r from-white/95 via-cyan-300/80 to-transparent"
          style={{ top: star.top, left: star.left, rotate: `${star.rotate}deg` }}
          initial={{ opacity: 0, x: 0, y: 0 }}
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  opacity: [0, 0.95, 0],
                  x: [0, -140, -220],
                  y: [0, 40, 72],
                }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : {
                  duration: star.duration,
                  delay: star.delay,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeOut",
                }
          }
        />
      ))}

      {rockets.map((rocket, index) => (
        <RocketTrail key={index} {...rocket} />
      ))}

      <motion.div
        className="absolute left-[8%] top-[26%] hidden h-10 w-20 rounded-full border border-cyan-300/40 bg-[linear-gradient(90deg,rgba(13,17,38,0.9),rgba(37,58,99,0.85))] shadow-[0_0_30px_rgba(102,234,255,0.16)] lg:block"
        animate={
          prefersReducedMotion
            ? undefined
            : {
                x: [0, 120, 0],
                y: [0, -18, 0],
                rotate: [0, 2, -1, 0],
              }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: 16,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      >
        <span className="absolute left-3 top-3 h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(165,243,252,0.9)]" />
        <span className="absolute left-7 top-3 h-2 w-2 rounded-full bg-fuchsia-200/90 shadow-[0_0_18px_rgba(245,208,254,0.7)]" />
        <span className="absolute right-[-10px] top-1/2 h-px w-5 -translate-y-1/2 bg-gradient-to-r from-cyan-200/90 to-transparent" />
      </motion.div>
    </div>
  );
}
