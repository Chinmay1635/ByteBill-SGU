"use client";

import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { PenBox, LayoutDashboard, Menu, X } from "lucide-react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import { FaChartLine,FaEnvelope } from "react-icons/fa";

export const HeaderClient = () => {
  const [isOpen, setIsOpen] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768); // 768px is Tailwind's md breakpoint
    };
  
    handleResize(); // Set initial value
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b">
      <nav className="container mx-auto px-1 sm:px-1 py-4 flex items-center justify-between">
        <div className="flex items-center justify-between w-full md:w-auto">
          <Link href="/">
          <Image
  src={"/logo4.png"}
  alt="ByteBill Logo"
  width={200}
  height={60}
  className={`h-12 object-contain ${isMobile ? 'w-14' : 'w-22'}`}
/>
          </Link>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-4">
            <SignedIn>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8",
                  },
                }}
              />
            </SignedIn>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 hover:text-blue-600 focus:outline-none"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <SignedOut>
            <a href="#features" className="text-gray-600 hover:text-blue-600">
              Features
            </a>
            <a
              href="#testimonials"
              className="text-gray-600 hover:text-blue-600"
            >
              Testimonials
            </a>
          </SignedOut>
        </div>

        {/* Desktop Action Buttons */}
        <div className="hidden md:flex items-center space-x-4">
          <SignedIn>
            <Link
              href="/Prediction"
              className="text-gray-600 hover:text-blue-600 flex items-center gap-2"
            >
              <Button variant="outline">
                <FaChartLine size={18} />
                <span className="hidden md:inline">Predict Expenses</span>
              </Button>
            </Link>
            <Link
              href="/gmail"
              className="text-gray-600 hover:text-blue-600 flex items-center gap-2"
            >
              <Button variant="outline">
              <FaEnvelope size={18} /> {/* Add the mail icon here */}
                <span className="hidden md:inline">Gmail Transactions</span>
              </Button>
            </Link>
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-blue-600 flex items-center gap-2"
            >
              <Button variant="outline">
                <LayoutDashboard size={18} />
                <span className="hidden md:inline">Dashboard</span>
              </Button>
            </Link>
            <a href="/transaction/create">
              <Button className="flex items-center gap-2">
                <PenBox size={18} />
                <span className="hidden md:inline">Add Transaction</span>
              </Button>
            </a>
          </SignedIn>
          <SignedOut>
            <SignInButton forceRedirectUrl="/dashboard">
              <Button variant="outline">Login</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10",
                },
              }}
            />
          </SignedIn>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden absolute top-20 left-0 right-0 bg-white border-t shadow-lg py-4 px-6">
            <div className="flex flex-col space-y-4">
              <SignedOut>
                <a
                  href="#features"
                  className="text-gray-600 hover:text-blue-600 py-2"
                  onClick={() => setIsOpen(false)}
                >
                  Features
                </a>
                <a
                  href="#testimonials"
                  className="text-gray-600 hover:text-blue-600 py-2"
                  onClick={() => setIsOpen(false)}
                >
                  Testimonials
                </a>
              </SignedOut>

              <SignedIn>
                <Link
                  href="/Prediction"
                  className="flex items-center gap-2 text-gray-600 hover:text-blue-600 py-2"
                  onClick={() => setIsOpen(false)}
                >
                  <FaChartLine size={18} />
                  <span>Predict Expenses</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-gray-600 hover:text-blue-600 py-2"
                  onClick={() => setIsOpen(false)}
                >
                  <LayoutDashboard size={18} />
                  <span>Dashboard</span>
                </Link>
                <Link
                  href="/transaction/create"
                  className="flex items-center gap-2 text-gray-600 hover:text-blue-600 py-2"
                  onClick={() => setIsOpen(false)}
                >
                  <PenBox size={18} />
                  <span>Add Transaction</span>
                </Link>
              </SignedIn>

              <SignedOut>
                <SignInButton forceRedirectUrl="/dashboard">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsOpen(false)}
                  >
                    Login
                  </Button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};