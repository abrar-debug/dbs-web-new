"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { format, addMonths } from "date-fns";
import { toast } from "react-hot-toast";

// Import your API utilities
import {
  getDoctors,
  authenticate_token,
  generate_otp,
  createPatient,
  createAppointment,
  getAvailableTimes,
  getQuestionnaire,
  verify_otp,
} from "../utils/api";

// Import your UI components (Tailwind-based or custom)
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";

// Env config for questionnaire
const isQuestionnaireEnabled =
  process.env.NEXT_PUBLIC_QUESTIONNAIRE_ENABLED === "1";
const questionnaireId = process.env.NEXT_PUBLIC_QUESTIONNAIRE_ID || 1;

/**
 * DoctorTabbedInfo Component
 * - Uses flex-wrap to prevent overflow on small screens.
 * - Each tab is 50% (w-1/2) on mobile => 2 tabs per row
 * - On sm: (≥640px), each tab is 25% (w-1/4) => all 4 on one row
 */
function DoctorTabbedInfo({ doctor }) {
  const [activeTab, setActiveTab] = useState("about");

  // Safely handle the "medicalAid" or "medical_aid" property
  const rawMedicalAid = doctor.medicalAid || doctor.medical_aid;

  // Fallback text for each property
  const aboutText = doctor.about || "No about info provided.";
  const qualificationsText = doctor.qualifications || "No qualifications provided.";
  const pricingText = doctor.pricing || "No pricing info provided.";

  let medicalAidText = "No medical aid info provided.";
  if (rawMedicalAid) {
    if (Array.isArray(rawMedicalAid)) {
      medicalAidText = rawMedicalAid.join(", ");
    } else {
      medicalAidText = rawMedicalAid;
    }
  }

  // Renders the content based on the activeTab
  const renderTabContent = () => {
    switch (activeTab) {
      case "about":
        return <p>{aboutText}</p>;
      case "qualifications":
        return <p>{qualificationsText}</p>;
      case "medicalAid":
        return <p>{medicalAidText}</p>;
      case "pricing":
        return <p>{pricingText}</p>;
      default:
        return null;
    }
  };

  // Tab styling
  const tabBaseClasses = `
    text-center px-4 py-2 text-sm sm:text-base
    border-r last:border-r-0
    transition-colors cursor-pointer
    hover:opacity-90
  `;
  function tabClasses(tabName) {
    const isActive = activeTab === tabName;
    return isActive
      ? `${tabBaseClasses} bg-primary text-white`
      : `${tabBaseClasses} bg-secondary text-gray-800`;
  }

  return (
    <div className="mt-4 border rounded-md bg-gray-100 w-full">
      {/* Tabs row - flex-wrap so it won't overflow */}
      <div className="flex flex-wrap w-full">
        <div
          onClick={() => setActiveTab("about")}
          className={`w-1/2 sm:w-1/4 ${tabClasses("about")}`}
        >
          About
        </div>
        <div
          onClick={() => setActiveTab("qualifications")}
          className={`w-1/2 sm:w-1/4 ${tabClasses("qualifications")}`}
        >
          Qualifications
        </div>
        <div
          onClick={() => setActiveTab("medicalAid")}
          className={`w-1/2 sm:w-1/4 ${tabClasses("medicalAid")}`}
        >
          Medical Aid
        </div>
        <div
          onClick={() => setActiveTab("pricing")}
          className={`w-1/2 sm:w-1/4 ${tabClasses("pricing")}`}
        >
          Pricing
        </div>
      </div>

      {/* Content area */}
      <div className="p-4 bg-white rounded-b-md">{renderTabContent()}</div>
    </div>
  );
}

/**
 * OTPInput Component
 * Renders a row of input boxes for OTP
 */
function OTPInput({ length, value, onChange }) {
  const inputsRef = useRef([]);

  const handleInputChange = (e, index) => {
    const inputValue = e.target.value;
    if (!/^\d*$/.test(inputValue)) return; // digits only

    let arr = value.split("");
    while (arr.length < length) {
      arr.push("");
    }
    arr[index] = inputValue.slice(-1); // keep last digit typed

    const newOtp = arr.join("");
    onChange(newOtp);

    // Auto-focus next input
    if (inputValue && index < length - 1) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    // If backspace on an empty box, move focus left
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };

  // Build array of digits from "value"
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  return (
    <div className="grid grid-cols-6 gap-2 mb-4">
      {digits.map((digit, idx) => (
        <input
          key={idx}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleInputChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          ref={(el) => (inputsRef.current[idx] = el)}
          className="w-12 h-12 text-center border rounded"
        />
      ))}
    </div>
  );
}

/**
 * MedicalQuestionnaire Component
 */
function MedicalQuestionnaire({ onFormDataChange, questionnaireFormData }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    const index = parseInt(name, 10);
    const updated = questionnaireFormData.questions.map((q, i) =>
      i === index ? { ...q, answer: value } : q
    );
    onFormDataChange({ ...questionnaireFormData, questions: updated });
  };

  const renderInput = (question, index) => {
    if (question.question_type === "multiple_choice" && question.choices) {
      const choices = question.choices.split(",").map((c) => c.trim());
      return (
        <select
          name={index}
          value={question.answer || ""}
          onChange={handleChange}
          className="border p-2 rounded w-full"
        >
          <option value="">Please select an option</option>
          {choices.map((choice, i) => (
            <option key={i} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      );
    }

    // Default is a textarea
    return (
      <textarea
        name={index}
        value={question.answer || ""}
        onChange={handleChange}
        placeholder="Please provide your answer"
        className="border p-2 rounded w-full"
      />
    );
  };

  return (
    <div className="p-4 border rounded my-4 w-full">
      <h3 className="text-lg font-bold mb-2">{questionnaireFormData.name}</h3>
      <p className="text-sm text-gray-500 mb-4">
        Please complete this brief medical questionnaire to help us better
        prepare for your appointment.
      </p>
      {questionnaireFormData.questions?.map((question, idx) => (
        <div key={idx} className="flex flex-col space-y-1 mb-3">
          <label className="font-semibold">{question.question_text}</label>
          {renderInput(question, idx)}
        </div>
      ))}
    </div>
  );
}

/**
 * AuthModal Component (login + OTP)
 */
function AuthModal({
  isOpen,
  onClose,
  onLogin,
  onOtpSubmit,
  authStage,
  phone,
  setPhone,
  otp,
  setOtp,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-md w-80">
        {authStage === "login" ? (
          <>
            <h2 className="text-lg font-semibold mb-4">Login</h2>
            <Label htmlFor="phone-modal">Phone Number</Label>
            <Input
              id="phone-modal"
              type="tel"
              placeholder="Enter phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mb-4"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => onLogin(phone)}>Send OTP</Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-4">Enter OTP</h2>
            <Label htmlFor="otp-input">OTP</Label>
            <OTPInput length={6} value={otp} onChange={setOtp} />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => onOtpSubmit(otp)}>Verify OTP</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * SuccessModal Component
 */
function SuccessModal({ isOpen, onClose, onViewAppointments }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-md w-80 text-center">
        <h2 className="text-lg font-semibold mb-4">Appointment Created</h2>
        <p className="mb-4">
          Your provisional appointment has been created. The doctor will review
          and confirm your appointment shortly. Please await confirmation before
          attending.
        </p>
        <div className="flex justify-center space-x-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onViewAppointments}>View Appointments</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main BookAppointmentNew Page
 */
export default function BookAppointmentNew() {
  const router = useRouter();

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [patient, setPatient] = useState(null);

  // Auth flow
  const [authStage, setAuthStage] = useState("login");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  // Appointment form data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(null);
  const [appointmentTime, setAppointmentTime] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Other data
  const [appointmentData, setAppointmentData] = useState(null);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [questionnaireData, setQuestionnaireData] = useState(null);

  // Modals
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // On mount
  useEffect(() => {
    fetchDoctors();
    checkAuthentication();
  }, []);

  // Fetch questionnaire if enabled
  useEffect(() => {
    if (isQuestionnaireEnabled) {
      getQuestionnaire(questionnaireId)
        .then((res) => {
          setQuestionnaireData(res.data);
        })
        .catch((err) => {
          console.error("Error fetching questionnaire:", err);
          toast.error("Failed to load questionnaire.");
        });
    }
  }, []);

  // Fetch times if doc + date
  useEffect(() => {
    if (selectedDoctor && appointmentDate) {
      const formatted = format(appointmentDate, "yyyy-MM-dd");
      getAvailableTimes(selectedDoctor.id, formatted, formatted)
        .then((res) => {
          const dataForDoc = res.data[selectedDoctor.id];
          const times =
            dataForDoc &&
            dataForDoc.available_appointments &&
            dataForDoc.available_appointments[formatted]
              ? dataForDoc.available_appointments[formatted]
              : [];
          setAvailableTimes(times);
        })
        .catch((err) => {
          console.error("Error fetching times:", err);
          toast.error("Failed to load available times.");
          setAvailableTimes([]);
        });
    } else {
      setAvailableTimes([]);
    }
  }, [selectedDoctor, appointmentDate]);

  // Fetch doctors
  const fetchDoctors = async () => {
    try {
      const response = await getDoctors();
      const doctorList = response.data?.results || response.data || response;
      setDoctors(doctorList);
    } catch (error) {
      console.error("Error fetching doctors:", error);
      toast.error("Failed to fetch doctors. Please try again.");
    }
  };

  // Check auth
  const checkAuthentication = async () => {
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const resp = await authenticate_token(token);
        setPatient(resp.data.patient);
      } catch (err) {
        toast.error("Authentication failed. Please log in again.");
        localStorage.removeItem("authToken");
      }
    }
  };

  // Book appointment
  const handleBookAppointment = async () => {
    if (!selectedDoctor) {
      toast.error("Please select a doctor.");
      return;
    }
    if (!firstName || !lastName || !phone || !appointmentDate || !appointmentTime) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!termsAccepted) {
      toast.error("Please accept the terms and conditions.");
      return;
    }

    const formattedDate = format(appointmentDate, "yyyy-MM-dd");
    const data = {
      doctor_id: selectedDoctor.id,
      date: formattedDate,
      time: appointmentTime,
      patient: {
        first_name: firstName,
        last_name: lastName,
        contact_number: phone,
      },
      questionnaire: isQuestionnaireEnabled ? questionnaireData : null,
    };

    setAppointmentData(data);

    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        await authenticate_token(token);
        await createAppointmentWithAuth(data);
      } catch (error) {
        toast.error("Token validation failed. Please verify via OTP.");
        await triggerOtpRequest();
      }
    } else {
      await triggerOtpRequest();
    }
  };

  // Trigger OTP if not logged in
  const triggerOtpRequest = async () => {
    try {
      await createPatient({ contact_number: phone });
      await generate_otp(phone);
      setAuthStage("otp");
      setIsAuthModalOpen(true);
    } catch (error) {
      toast.error("Failed to send OTP. Please try again.");
    }
  };

  // OTP submission
  const handleOtpSubmit = async (submittedOtp) => {
    try {
      const resp = await verify_otp(phone, submittedOtp);
      localStorage.setItem("authToken", resp.data.token);
      setPatient(resp.data.patient);
      setIsAuthModalOpen(false);
      toast.success("OTP verified successfully!");
      setOtp("");
      await createAppointmentWithAuth(appointmentData);
    } catch (error) {
      toast.error("OTP verification failed. Please try again.");
      setOtp("");
    }
  };

  // Create appointment
  const createAppointmentWithAuth = async (data) => {
    try {
      await createAppointment(data);
      setIsSuccessModalOpen(true);
      toast.success("Appointment created successfully!");
    } catch (error) {
      if (error.response && error.response.status === 403) {
        toast.error("Authentication failed. Please log in again.");
        setIsAuthModalOpen(true);
      } else {
        toast.error("Failed to create appointment. Please try again.");
      }
    }
  };

  // Login from modal
  const handleLogin = async (phoneNumber) => {
    setPhone(phoneNumber);
    try {
      await createPatient({ contact_number: phoneNumber });
      await generate_otp(phoneNumber);
      setAuthStage("otp");
    } catch (error) {
      toast.error("Failed to process login. Please try again.");
    }
  };

  // Close modals
  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthStage("login");
    setOtp("");
  };

  const handleSuccessModalClose = () => {
    setIsSuccessModalOpen(false);
  };

  const handleViewAppointments = () => {
    setIsSuccessModalOpen(false);
    router.push("/manage-appointment");
  };

  // Render
  return (
    <div className="mx-auto w-full max-w-3xl py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Book an Appointment</h1>

      {/* Doctor Selection */}
      <div className="mb-6 w-full">
        <Label htmlFor="doctor" className="text-xl font-semibold mb-2 block">
          Select a Doctor
        </Label>
        <div className="relative w-full">
          <select
            className="block w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none"
            onChange={(e) =>
              setSelectedDoctor(
                doctors.find((d) => d.id === parseInt(e.target.value))
              )
            }
            defaultValue=""
          >
            <option value="" disabled>
              Choose your doctor
            </option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {`${doctor.first_name} ${doctor.last_name}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Doctor info & booking form */}
      {selectedDoctor && (
        <>
          <Card className="mb-6 w-full">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                {`${selectedDoctor.first_name} ${selectedDoctor.last_name}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Only center the avatar */}
              <div className="flex items-center justify-center mb-4">
                <Avatar className="h-20 w-20">
                  {selectedDoctor.image ? (
                    <AvatarImage
                      src={selectedDoctor.image}
                      alt={`${selectedDoctor.first_name} ${selectedDoctor.last_name}`}
                    />
                  ) : (
                    <AvatarFallback>
                      {`${selectedDoctor.first_name[0]}${selectedDoctor.last_name[0]}`}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>

              <DoctorTabbedInfo doctor={selectedDoctor} />
            </CardContent>
          </Card>

          {/* Booking Form */}
          <div className="w-full space-y-6 mb-12">
            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="Enter your first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Enter your last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Cellphone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter your cellphone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {/* Date/Time side-by-side on sm+ */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Date */}
              <div className="flex-1 space-y-2">
                <Label className="block font-semibold">Select Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-start text-left font-normal w-full"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {appointmentDate
                        ? format(appointmentDate, "PPP")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={appointmentDate}
                      onSelect={setAppointmentDate}
                      initialFocus
                      disabled={{
                        before: new Date(),
                        after: addMonths(new Date(), 1),
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Bubbles */}
              <div className="flex-1 space-y-2">
                <Label className="block font-semibold">Select Time</Label>
                <div className="flex flex-wrap gap-2">
                  {availableTimes.length > 0 ? (
                    availableTimes.map((time, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setAppointmentTime(time)}
                        className={`
                          px-4 py-2 rounded-full border-2 transition-colors text-sm
                          ${
                            appointmentTime === time
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"
                          }
                        `}
                      >
                        {time}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No available times</p>
                  )}
                </div>
              </div>
            </div>

            {/* Optional Questionnaire */}
            {isQuestionnaireEnabled &&
              questionnaireData &&
              questionnaireData.questions && (
                <MedicalQuestionnaire
                  onFormDataChange={setQuestionnaireData}
                  questionnaireFormData={questionnaireData}
                />
              )}

            {/* Terms Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) =>
                  setTermsAccepted(checked === true)
                }
              />
              <Label htmlFor="terms" className="text-sm">
                I agree to the terms and conditions and consent to the
                processing of my personal information
              </Label>
            </div>

            <Button
              className="w-full"
              disabled={!termsAccepted}
              onClick={handleBookAppointment}
            >
              Book Appointment
            </Button>
          </div>
        </>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onLogin={handleLogin}
        onOtpSubmit={handleOtpSubmit}
        authStage={authStage}
        phone={phone}
        setPhone={setPhone}
        otp={otp}
        setOtp={setOtp}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={handleSuccessModalClose}
        onViewAppointments={handleViewAppointments}
      />
    </div>
  );
}
