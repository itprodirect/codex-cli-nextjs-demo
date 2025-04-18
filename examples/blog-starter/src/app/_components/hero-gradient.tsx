import React from "react";
import Link from "next/link";

/**
 * Gradient hero section mimicking OpenAI homepage style.
 */
export function HeroGradient() {
  return (
    <section className="w-full bg-gradient-to-r from-green-400 via-yellow-300 to-pink-500">
      <div className="max-w-5xl mx-auto py-20 px-6 text-left">
        <h1 className="text-6xl font-extrabold text-black">
          Thinking
        </h1>
        <p className="mt-4 text-xl text-black opacity-90">
          Explore the power of OpenAI’s generative models directly from your CLI.
        </p>
        <Link
          href="/"
          className="inline-block mt-8 px-6 py-3 bg-black text-white rounded-lg font-medium hover:opacity-90"
        >
          Get Started
        </Link>
      </div>
    </section>
  );
}