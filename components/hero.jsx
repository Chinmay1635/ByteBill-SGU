"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import clsx from "clsx";

const rotatingWords = [
  "Intelligent Tools",
  "Google Tools",
  "BigQuery ML",
  "Vision OCR",
  "AI Insights"
];

const images = [
  "/banner1.png",
  "/banner2.png",
  "/banner3.png",
  "/banner4.png"
];

const HeroSection = () => {
  const [typedText, setTypedText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);

  // Typing effect
  useEffect(() => {
    const currentWord = rotatingWords[wordIndex];

    if (charIndex < currentWord.length) {
      const typingTimeout = setTimeout(() => {
        setTypedText(currentWord.slice(0, charIndex + 1));
        setCharIndex((prev) => prev + 1);
      }, 100);
      return () => clearTimeout(typingTimeout);
    } else {
      const pauseTimeout = setTimeout(() => {
        setCharIndex(0);
        setWordIndex((prevIndex) => (prevIndex + 1) % rotatingWords.length);
      }, 1500);
      return () => clearTimeout(pauseTimeout);
    }
  }, [charIndex, wordIndex]);

  // Image carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="pt-24 pb-20 px-4 bg-white"> {/* Increased top padding for overall push down */}
      <div className="container mx-auto text-center">
        <h1 className="text-5xl md:text-6xl lg:text-6xl pb-10 mt-6 gradient-title"> {/* Smaller font + added margin top */}
          <span className="inline-block">Empower Your Wallet with</span>
          <br />
          <span className="inline-block ml-3 text-purple-800 transition-all duration-500 ease-in-out min-w-[200px]">
            {typedText}
          </span>
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          An AI-powered financial management platform that helps you track,
          analyze, and optimize your spending with real-time insights.
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/dashboard">
            <Button size="lg" className="px-8 bg-purple-700">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Fading image slider with fixed box */}
        <div className="relative w-full max-w-6xl h-[400px] mx-auto mt-12 overflow-hidden rounded-3xl bg-white">
          {images.map((img, index) => (
            <Image
              key={index}
              src={img}
              width={1280}
              height={600}
              alt={`Slide ${index + 1}`}
              className={clsx(
                "absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out",
                {
                  "opacity-0": index !== currentImage,
                  "opacity-100": index === currentImage,
                }
              )}
              priority={index === currentImage}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;