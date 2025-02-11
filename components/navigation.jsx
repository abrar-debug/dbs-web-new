"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Calendar, Users } from 'lucide-react';

export function Navigation() {
  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl">
          MediBook
        </Link>
        <div className="flex gap-4">
          <Link href="/book-appointment">
            <Button variant="ghost" size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Book Appointment
            </Button>
          </Link>
          <Link href="/manage-appointment">
            <Button variant="ghost" size="sm">
              <Users className="mr-2 h-4 w-4" />
              Manage Appointments
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}