"use client";

import { useState } from "react";
import { RocketIcon, SparklesIcon, StarIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

interface AdminSpaceCatProps {
  mode?: "dashboard" | "profile" | "users";
}

const catModeStyles = {
  dashboard: {
    label: "Space Cat",
    bubble:
      "border-cyan-300/25 bg-cyan-300/10 text-cyan-100/85",
    glow: "bg-cyan-300/12",
  },
  profile: {
    label: "ID Cat",
    bubble:
      "border-violet-300/25 bg-violet-300/10 text-violet-100/85",
    glow: "bg-violet-300/12",
  },
  users: {
    label: "Crew Cat",
    bubble:
      "border-sky-300/25 bg-sky-300/10 text-sky-100/85",
    glow: "bg-sky-300/12",
  },
} as const;

export function AdminSpaceCat({ mode = "dashboard" }: AdminSpaceCatProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const style = catModeStyles[mode];

  return (
    <motion.div
      className="relative mx-auto h-44 w-44 sm:h-48 sm:w-48"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={
        prefersReducedMotion
          ? undefined
          : { scale: 1.04, rotate: 1.2 }
      }
      animate={
        prefersReducedMotion
          ? undefined
          : {
              y: [0, -8, 0, 6, 0],
              rotate: [0, -1.4, 0.8, 0],
            }
      }
      transition={
        prefersReducedMotion
          ? undefined
          : {
              duration: 5.5,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }
      }
    >
      <motion.div
        className={`absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl ${style.glow}`}
        animate={
          prefersReducedMotion
            ? undefined
            : isHovered
              ? { scale: [1, 1.2, 1.08], opacity: [0.3, 0.55, 0.4] }
              : { scale: [1, 1.08, 1], opacity: [0.18, 0.28, 0.18] }
        }
        transition={{
          duration: isHovered ? 1.1 : 2.4,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className={`absolute left-4 top-4 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${style.bubble}`}
        animate={
          prefersReducedMotion ? undefined : { opacity: [0.7, 1, 0.8] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: 2.8,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      >
        {style.label}
      </motion.div>

      <motion.div
        className="absolute right-3 top-7 text-cyan-200/80"
        animate={
          prefersReducedMotion
            ? undefined
            : { scale: [1, 1.35, 1], rotate: [0, 14, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 2.6, repeat: Number.POSITIVE_INFINITY }
        }
      >
        <StarIcon className="size-4" />
      </motion.div>
      <motion.div
        className="absolute left-2 top-14 text-fuchsia-200/75"
        animate={
          prefersReducedMotion
            ? undefined
            : { scale: [1, 1.25, 1], opacity: [0.6, 1, 0.7] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 2.2, repeat: Number.POSITIVE_INFINITY, delay: 0.5 }
        }
      >
        <SparklesIcon className="size-4" />
      </motion.div>
      <motion.div
        className="absolute right-7 bottom-6 text-violet-200/75"
        animate={
          prefersReducedMotion
            ? undefined
            : { x: [0, 6, 0], y: [0, -3, 0], rotate: [0, -12, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 3.2, repeat: Number.POSITIVE_INFINITY, delay: 0.9 }
        }
      >
        <RocketIcon className="size-4" />
      </motion.div>

      <div className="absolute left-1/2 top-8 h-28 w-28 -translate-x-1/2 rounded-full border border-white/20 bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.78),rgba(255,255,255,0.14)_42%,rgba(255,255,255,0.08)_62%,transparent_72%)] shadow-[0_0_30px_rgba(125,211,252,0.16)] backdrop-blur-md">
        <motion.div
          className="absolute left-1/2 top-[22px] h-16 w-16 -translate-x-1/2 rounded-full bg-orange-200"
          animate={
            prefersReducedMotion
              ? undefined
              : isHovered
                ? { y: [0, -1, 1, 0], rotate: [0, -4, 4, 0] }
                : { y: [0, 1, 0], rotate: [0, -2, 2, 0] }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : {
                  duration: isHovered ? 1.7 : 3.8,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }
          }
        >
          <div className="absolute -left-1 top-0 h-5 w-5 rotate-[-20deg] rounded-tl-[14px] rounded-tr-[14px] rounded-br-[6px] bg-orange-300" />
          <div className="absolute -right-1 top-0 h-5 w-5 rotate-[20deg] rounded-tl-[14px] rounded-tr-[14px] rounded-bl-[6px] bg-orange-300" />
          <motion.div
            className="absolute left-[14px] top-[21px] h-2.5 w-2 rounded-full bg-slate-900"
            animate={prefersReducedMotion ? undefined : { scaleY: [1, 0.35, 1] }}
            transition={{
              duration: 3.4,
              repeat: Number.POSITIVE_INFINITY,
              times: [0, 0.08, 0.16],
              delay: 1.6,
            }}
          />
          <motion.div
            className="absolute right-[14px] top-[21px] h-2.5 w-2 rounded-full bg-slate-900"
            animate={prefersReducedMotion ? undefined : { scaleY: [1, 0.35, 1] }}
            transition={{
              duration: 3.4,
              repeat: Number.POSITIVE_INFINITY,
              times: [0, 0.08, 0.16],
              delay: 1.6,
            }}
          />
          <div className="absolute left-1/2 top-[28px] h-2 w-2 -translate-x-1/2 rotate-45 rounded-[2px] bg-rose-300" />
          <motion.div
            className="absolute left-1/2 top-[36px] h-4 w-7 -translate-x-1/2 rounded-b-full border-b-2 border-slate-900/70"
            animate={
              prefersReducedMotion
                ? undefined
                : isHovered
                  ? { scaleX: [1, 1.16, 1], y: [0, -1, 0] }
                  : { scaleX: [1, 1.06, 1] }
            }
            transition={{
              duration: isHovered ? 1.2 : 2.8,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          />
          <div className="absolute left-[10px] top-[30px] h-px w-4 bg-slate-900/35" />
          <div className="absolute left-[6px] top-[34px] h-px w-5 bg-slate-900/30" />
          <div className="absolute right-[10px] top-[30px] h-px w-4 bg-slate-900/35" />
          <div className="absolute right-[6px] top-[34px] h-px w-5 bg-slate-900/30" />
        </motion.div>
      </div>

      <motion.div
        className="absolute left-1/2 top-[105px] h-16 w-[90px] -translate-x-1/2 rounded-[28px] border border-cyan-200/20 bg-[linear-gradient(180deg,rgba(220,242,255,0.94),rgba(160,210,245,0.78))] shadow-[0_12px_30px_rgba(56,189,248,0.16)]"
        animate={
          prefersReducedMotion
            ? undefined
            : isHovered
              ? { rotate: [0, -2.8, 2.8, 0], y: [0, -2, 2, 0] }
              : { rotate: [0, -1.2, 1.2, 0], y: [0, 2, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : {
                duration: isHovered ? 1.6 : 4.2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      >
        <div className="absolute left-1/2 top-3 h-7 w-10 -translate-x-1/2 rounded-xl bg-slate-900/82" />
        <motion.div
          className="absolute bottom-3 left-4 h-3 w-3 rounded-full bg-cyan-300/70"
          animate={
            prefersReducedMotion
              ? undefined
              : isHovered
                ? { opacity: [0.35, 1, 0.35], scale: [1, 1.35, 1] }
                : { opacity: [0.5, 1, 0.55] }
          }
          transition={{
            duration: isHovered ? 0.8 : 1.6,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-3 right-4 h-3 w-3 rounded-full bg-violet-300/70"
          animate={
            prefersReducedMotion
              ? undefined
              : isHovered
                ? { opacity: [1, 0.3, 1], scale: [1, 1.35, 1] }
                : { opacity: [1, 0.45, 1] }
          }
          transition={{
            duration: isHovered ? 0.9 : 1.8,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      <motion.div
        className="absolute left-[43px] top-[145px] h-11 w-4 rotate-[16deg] rounded-full bg-slate-100/95"
        animate={
          prefersReducedMotion
            ? undefined
            : isHovered
              ? { rotate: [16, 6, 20, 16], x: [0, -1, 1, 0] }
              : { rotate: [16, 11, 16] }
        }
        transition={{
          duration: isHovered ? 1.2 : 2.4,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute right-[43px] top-[145px] h-11 w-4 rotate-[-16deg] rounded-full bg-slate-100/95"
        animate={
          prefersReducedMotion
            ? undefined
            : isHovered
              ? { rotate: [-16, -6, -20, -16], x: [0, 1, -1, 0] }
              : { rotate: [-16, -11, -16] }
        }
        transition={{
          duration: isHovered ? 1.2 : 2.4,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute right-[-8px] top-[96px] h-px w-10 bg-gradient-to-r from-cyan-100/0 via-cyan-100/80 to-fuchsia-200/0"
        animate={
          prefersReducedMotion
            ? undefined
            : isHovered
              ? { opacity: [0.2, 1, 0.2], x: [0, 10, 0], scaleX: [0.8, 1.25, 0.8] }
              : { opacity: [0, 0.35, 0], x: [0, 4, 0] }
        }
        transition={{
          duration: isHovered ? 0.7 : 2.1,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <div className="absolute left-[37px] top-[179px] h-4 w-7 rounded-full bg-cyan-200/85" />
      <div className="absolute right-[37px] top-[179px] h-4 w-7 rounded-full bg-cyan-200/85" />
    </motion.div>
  );
}
