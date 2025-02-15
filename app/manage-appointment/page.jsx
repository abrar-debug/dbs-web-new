"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

// Import only what's needed; remove editAppointment
import {
  authenticate_token,
  getPatientAppointments,
  getCancelledAppointments,
  generate_otp,
  verify_otp,
  changeAppointmentStatus,
} from "../utils/api";

// UI components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit2, X } from "lucide-react";

const containerClass = "container mx-auto py-8 px-4";

export default function ManageAppointment() {
  const router = useRouter();

  // Authentication and appointments state
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [cancelledAppointments, setCancelledAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Auth stage: "checking", "login", "otp", or "authenticated"
  const [authStage, setAuthStage] = useState("checking");
  const [contactNumber, setContactNumber] = useState("");

  // OTP state
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  // State for editing/cancelling appointments
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);

  // --------------------------------------------------
  // FETCH APPOINTMENTS
  const fetchAppointments = useCallback(async (patientId) => {
    try {
      const response = await getPatientAppointments(patientId);
      setAppointments(response.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setError("Error occurred when fetching appointments");
      setAppointments([]);
      toast.error("Failed to fetch appointments.");
    }
  }, []);

  const fetchCancelledAppointments = useCallback(async (patientId) => {
    try {
      const cancelledData = await getCancelledAppointments(patientId);
      if (Array.isArray(cancelledData)) {
        setCancelledAppointments(
          cancelledData.map((appt) => ({ ...appt, status: "CNC" }))
        );
      } else {
        console.error("Invalid cancelled appointments data:", cancelledData);
        setCancelledAppointments([]);
      }
    } catch (err) {
      console.error("Error fetching cancelled appointments:", err);
      setCancelledAppointments([]);
      toast.error("Failed to fetch cancelled appointments.");
    }
  }, []);

  // --------------------------------------------------
  // AUTH CHECK
  const checkAuthentication = useCallback(async () => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setAuthStage("login");
      setIsLoading(false);
      return;
    }
    try {
      const response = await authenticate_token(token);
      setPatient(response.data.patient);
      setAuthStage("authenticated");
      await fetchAppointments(response.data.patient.id);
      await fetchCancelledAppointments(response.data.patient.id);
    } catch (err) {
      localStorage.removeItem("authToken");
      setAuthStage("login");
      toast.error("Authentication failed. Please log in again.");
    }
    setIsLoading(false);
  }, [fetchAppointments, fetchCancelledAppointments]);

  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

  // --------------------------------------------------
  // OTP LOGIC
  const handleOtpChange = (index, value) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      if (value !== "" && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const joinOtp = () => otp.join("");

  const handleLogin = async (phone) => {
    setContactNumber(phone);
    try {
      await generate_otp(phone);
      setAuthStage("otp");
      setError(null);
      toast.success("OTP sent successfully.");
    } catch (err) {
      if (err.response && err.response.status === 404) {
        toast.error("This phone number is not registered in our system.");
      } else {
        setError("Failed to send OTP. Please try again.");
        toast.error("Failed to send OTP. Please try again.");
      }
    }
  };

  const handleOtpSubmit = async () => {
    const otpString = joinOtp();
    try {
      const response = await verify_otp(contactNumber, otpString);
      localStorage.setItem("authToken", response.data.token);
      setPatient(response.data.patient);
      setAuthStage("authenticated");
      await fetchAppointments(response.data.patient.id);
      await fetchCancelledAppointments(response.data.patient.id);
      toast.success("OTP verified and authenticated successfully.");
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      setError("OTP verification failed. Please try again.");
      toast.error("OTP verification failed. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      setAuthStage("login");
    }
  };

  // --------------------------------------------------
  // LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setPatient(null);
    setAppointments([]);
    setCancelledAppointments([]);
    setAuthStage("login");
    router.push("/manage-appointment");
    toast.success("Logged out successfully.");
  };

  // --------------------------------------------------
  // EDIT (No Actual Logic)
  // 1) Open the edit modal
  const openEditModal = (appointment) => {
    setAppointmentToEdit(appointment);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setAppointmentToEdit(null);
  };

  // --------------------------------------------------
  // CANCEL LOGIC
  const openCancelModal = (appointment) => {
    setAppointmentToCancel(appointment);
    setIsCancelModalOpen(true);
  };

  const closeCancelModal = () => {
    setIsCancelModalOpen(false);
    setAppointmentToCancel(null);
  };

  const cancelAppointment = async () => {
    try {
      await changeAppointmentStatus(appointmentToCancel.id, "CNC", {
        old_appointment_dt: {
          date: appointmentToCancel.date,
          time: appointmentToCancel.time,
        },
      });
      // Remove from upcoming appointments
      setAppointments((prev) =>
        prev.filter((appt) => appt.id !== appointmentToCancel.id)
      );
      // Add to cancelled
      setCancelledAppointments((prev) => [
        ...prev,
        { ...appointmentToCancel, status: "CNC" },
      ]);
      toast.success("Appointment cancelled successfully.");
    } catch (error) {
      toast.error("Failed to cancel appointment. Please try again.");
    }
    closeCancelModal();
  };

  // --------------------------------------------------
  // CATEGORIZE APPOINTMENTS
  const getUpcomingAppointments = () => {
    const now = new Date();
    return appointments
      .filter((appointment) => {
        const apptDateTime = new Date(`${appointment.date}T${appointment.time}`);
        return apptDateTime >= now;
      })
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`)
      );
  };

  const getPreviousAppointments = () => {
    const now = new Date();
    return appointments
      .filter((appointment) => {
        const apptDateTime = new Date(`${appointment.date}T${appointment.time}`);
        return apptDateTime < now;
      })
      .sort(
        (a, b) =>
          new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`)
      );
  };

  const upcomingAppointments = getUpcomingAppointments();
  const previousAppointments = getPreviousAppointments();
  const cancelled = cancelledAppointments;

  // --------------------------------------------------
  // RENDER
  if (isLoading) {
    return <div className={containerClass}>Loading...</div>;
  }

  if (authStage === "login") {
    return (
      <div className={containerClass}>
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter phone number"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>
            <Button
              onClick={() => handleLogin(contactNumber)}
              disabled={!contactNumber || contactNumber.length < 10}
            >
              Send OTP
            </Button>
            {error && <p className="text-red-600">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authStage === "otp") {
    return (
      <div className={containerClass}>
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Enter OTP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              An OTP has been sent to {contactNumber}. Please enter the 6-digit OTP below.
            </p>
            <div className="flex gap-2 justify-between">
              {otp.map((digit, index) => (
                <Input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-12 text-center text-lg"
                />
              ))}
            </div>
            <Button
              onClick={handleOtpSubmit}
              disabled={otp.some((digit) => digit === "")}
            >
              Verify OTP
            </Button>
            <Button onClick={() => handleLogin(contactNumber)} variant="outline">
              Resend OTP
            </Button>
            {error && <p className="text-red-600">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Authenticated view
  return (
    <div className={containerClass}>
      <h1 className="text-3xl font-bold mb-8">Manage Appointments</h1>
      <Button onClick={handleLogout} className="mb-4">
        Logout
      </Button>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="previous">Previous</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        {/* Upcoming */}
        <TabsContent value="upcoming">
          {upcomingAppointments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Edit</TableHead>
                      <TableHead>Cancel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingAppointments.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>{app.id}</TableCell>
                        <TableCell>{app.date}</TableCell>
                        <TableCell>{app.time}</TableCell>
                        <TableCell>
                          {app.patient
                            ? `${app.patient.first_name} ${app.patient.last_name}`
                            : ""}
                        </TableCell>
                        <TableCell>
                          {app.patient ? app.patient.contact_number : ""}
                        </TableCell>
                        <TableCell>
                          {typeof app.doctor === "object"
                            ? `${app.doctor.first_name} ${app.doctor.last_name}`
                            : app.doctor}
                        </TableCell>
                        <TableCell>{app.status}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            onClick={() => openEditModal(app)}
                            aria-label="Edit Appointment"
                          >
                            <Edit2 className="h-5 w-5" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            onClick={() => openCancelModal(app)}
                            aria-label="Cancel Appointment"
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p>No upcoming appointments found.</p>
          )}
        </TabsContent>

        {/* Previous */}
        <TabsContent value="previous">
          {previousAppointments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Previous Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previousAppointments.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>{app.id}</TableCell>
                        <TableCell>{app.date}</TableCell>
                        <TableCell>{app.time}</TableCell>
                        <TableCell>
                          {app.patient
                            ? `${app.patient.first_name} ${app.patient.last_name}`
                            : ""}
                        </TableCell>
                        <TableCell>
                          {app.patient ? app.patient.contact_number : ""}
                        </TableCell>
                        <TableCell>
                          {typeof app.doctor === "object"
                            ? `${app.doctor.first_name} ${app.doctor.last_name}`
                            : app.doctor}
                        </TableCell>
                        <TableCell>{app.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p>No previous appointments found.</p>
          )}
        </TabsContent>

        {/* Cancelled */}
        <TabsContent value="cancelled">
          {cancelled.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Cancelled Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cancelled.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>{app.id}</TableCell>
                        <TableCell>{app.date}</TableCell>
                        <TableCell>{app.time}</TableCell>
                        <TableCell>
                          {app.patient
                            ? `${app.patient.first_name} ${app.patient.last_name}`
                            : ""}
                        </TableCell>
                        <TableCell>
                          {app.patient ? app.patient.contact_number : ""}
                        </TableCell>
                        <TableCell>
                          {typeof app.doctor === "object"
                            ? `${app.doctor.first_name} ${app.doctor.last_name}`
                            : app.doctor}
                        </TableCell>
                        <TableCell>{app.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p>No cancelled appointments found.</p>
          )}
        </TabsContent>
      </Tabs>

      {/* ------------------------------
          EDIT APPOINTMENT MODAL (No logic)
       ------------------------------ */}
      {isEditModalOpen && appointmentToEdit && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-md">
            {/* The form or placeholder goes here, but does nothing */}
            {/* Example: If you have a custom <AppointmentForm> component, you can pass no-op callbacks */}
            <AppointmentForm
              appointmentToEdit={appointmentToEdit}
              onSuccess={() => {
                // Do nothing
                toast("Pretend we saved the appointment!");
              }}
              onCancel={() => {
                setIsEditModalOpen(false);
                setAppointmentToEdit(null);
              }}
            />

            {/* Alternatively, just a placeholder:
                <h2 className="text-xl font-bold">Edit Appointment</h2>
                <p>All fields are disabled; no actual edit logic.</p>
                <Button onClick={() => {
                  setIsEditModalOpen(false);
                  setAppointmentToEdit(null);
                }}>
                  Close
                </Button>
            */}
          </div>
        </div>
      )}

      {/* ------------------------------
          CANCEL CONFIRMATION MODAL
       ------------------------------ */}
      {isCancelModalOpen && appointmentToCancel && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-md w-96 text-center">
            <p className="mb-4">
              Are you sure you want to cancel appointment #{appointmentToCancel.id}?
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={closeCancelModal}>
                No
              </Button>
              <Button variant="destructive" onClick={cancelAppointment}>
                Yes, Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
