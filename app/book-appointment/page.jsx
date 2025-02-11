"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { format, addMonths } from "date-fns";
import { toast } from "react-hot-toast";

// Import API functions (including verify_otp)
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

// Import UI components
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
// Import the Tailwind Calendar component
import { Calendar } from "@/components/ui/calendar";

// Feature flag and questionnaire ID (fallback to 1 if not defined)
const isQuestionnaireEnabled =
  process.env.NEXT_PUBLIC_QUESTIONNAIRE_ENABLED === "1";
const questionnaireId = process.env.NEXT_PUBLIC_QUESTIONNAIRE_ID || 1;

/* ----------------------------------------------------
   Inline MedicalQuestionnaire Component Implementation
---------------------------------------------------- */
function MedicalQuestionnaire({ onFormDataChange, questionnaireFormData }) {
  // Handle changes to an answer for a question.
  const handleChange = (e) => {
    const { name, value } = e.target;
    const index = parseInt(name, 10);
    const updatedQuestions = questionnaireFormData.questions.map((question, i) =>
      i === index ? { ...question, answer: value } : question
    );
    onFormDataChange({ ...questionnaireFormData, questions: updatedQuestions });
  };

  // Render the appropriate input based on question type.
  const renderInput = (question, index) => {
    if (question.question_type === "multiple_choice" && question.choices) {
      const choices = question.choices.split(",").map((c) => c.trim());
      return (
        <select
          name={index}
          value={question.answer || ""}
          onChange={handleChange}
          className="border p-2 rounded"
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
    return (
      <textarea
        name={index}
        value={question.answer || ""}
        onChange={handleChange}
        placeholder="Please provide your answer"
        className="border p-2 rounded"
      />
    );
  };

  return (
    <div className="p-4 border rounded my-4">
      <h3 className="text-lg font-bold mb-2">{questionnaireFormData.name}</h3>
      <p className="text-sm text-gray-500 mb-4">
        Please complete this brief medical questionnaire to help us better
        prepare for your appointment.
      </p>
      {questionnaireFormData.questions?.map((question, index) => (
        <div key={index} className="flex flex-col space-y-1 mb-3">
          <label className="font-semibold">{question.question_text}</label>
          {renderInput(question, index)}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------
   OTPInput Component
   Renders multiple inputs with one digit per block.
---------------------------------------------------- */
function OTPInput({ length, value, onChange }) {
  const inputsRef = useRef([]);

  const handleInputChange = (e, index) => {
    const inputValue = e.target.value;
    // Allow only digits
    if (!/^\d*$/.test(inputValue)) {
      return;
    }
    // Create an array of digits from the current value
    let newValueArr = value.split("");
    // Ensure the array has the correct length
    while (newValueArr.length < length) {
      newValueArr.push("");
    }
    // Take only the last character (in case someone pastes more than one digit)
    newValueArr[index] = inputValue.slice(-1);
    const otpStr = newValueArr.join("");
    onChange(otpStr);
    // Automatically focus the next input if a digit was entered
    if (inputValue && index < length - 1) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    // On Backspace, if the current input is empty, move focus to the previous input
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };

  // Build an array with each digit (or empty string if not provided)
  const otpDigits = Array.from({ length }, (_, i) => value[i] || "");

  return (
    <div className="flex space-x-2 mb-4">
      {otpDigits.map((digit, index) => (
        <input
          key={index}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleInputChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          ref={(el) => (inputsRef.current[index] = el)}
          className="w-12 h-12 text-center border rounded"
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------
   AuthModal Component (with controlled OTP input)
---------------------------------------------------- */
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
          <div>
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
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold mb-4">Enter OTP</h2>
            <Label htmlFor="otp-input">OTP</Label>
            {/* Use OTPInput to render one digit per input block */}
            <OTPInput length={6} value={otp} onChange={setOtp} />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => onOtpSubmit(otp)}>Verify OTP</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------
   SuccessModal Component
---------------------------------------------------- */
function SuccessModal({ isOpen, onClose, onViewAppointments }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-md w-80 text-center">
        <h2 className="text-lg font-semibold mb-4">Appointment Created</h2>
        <p className="mb-4">
          Your provisional appointment has been created. The doctor will review
          and confirm your appointment shortly, please await confirmation BEFORE
          attending. You can track the status in the Manage Appointment section.
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

/* ----------------------------------------------------
   Main BookAppointmentNew Component
---------------------------------------------------- */
export default function BookAppointmentNew() {
  const router = useRouter();

  // Appointment and auth state
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [patient, setPatient] = useState(null);
  const [authStage, setAuthStage] = useState("login");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [phone, setPhone] = useState("");

  // Controlled OTP state
  const [otp, setOtp] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(null);
  const [appointmentTime, setAppointmentTime] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [appointmentData, setAppointmentData] = useState(null);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [questionnaireData, setQuestionnaireData] = useState(null);

  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // On mount, fetch doctors and check authentication
  useEffect(() => {
    fetchDoctors();
    checkAuthentication();
  }, []);

  // Fetch the questionnaire if enabled
  useEffect(() => {
    if (isQuestionnaireEnabled) {
      getQuestionnaire(questionnaireId)
        .then((response) => {
          // Expect response.data to contain "name" and "questions"
          setQuestionnaireData(response.data);
        })
        .catch((error) => {
          console.error("Error fetching questionnaire:", error);
          toast.error("Failed to load questionnaire.");
        });
    }
  }, [isQuestionnaireEnabled]);

  // Fetch available times (start and end date are the same)
  useEffect(() => {
    if (selectedDoctor && appointmentDate) {
      const formattedDate = format(appointmentDate, "yyyy-MM-dd");
      console.log(
        "Fetching available times for doctor",
        selectedDoctor.id,
        "for date",
        formattedDate
      );
      getAvailableTimes(selectedDoctor.id, formattedDate, formattedDate)
        .then((response) => {
          const dataForDoctor = response.data[selectedDoctor.id];
          const times =
            dataForDoctor &&
            dataForDoctor.available_appointments &&
            dataForDoctor.available_appointments[formattedDate]
              ? dataForDoctor.available_appointments[formattedDate]
              : [];
          console.log("Available times from API:", times);
          setAvailableTimes(times);
        })
        .catch((error) => {
          console.error("Error fetching available times:", error);
          toast.error("Failed to load available times.");
          setAvailableTimes([]);
        });
    } else {
      setAvailableTimes([]);
    }
  }, [selectedDoctor, appointmentDate]);

  // Helper functions
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

  const checkAuthentication = async () => {
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const response = await authenticate_token(token);
        setPatient(response.data.patient);
      } catch (error) {
        toast.error("Authentication failed. Please log in again.");
        localStorage.removeItem("authToken");
      }
    }
  };

  // When the user clicks "Book Appointment"
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

  // Trigger OTP request via backend and open OTP modal
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

  // Handle OTP submission using backend verification
  const handleOtpSubmit = async (submittedOtp) => {
    try {
      const response = await verify_otp(phone, submittedOtp);
      localStorage.setItem("authToken", response.data.token);
      setPatient(response.data.patient);
      setIsAuthModalOpen(false);
      toast.success("OTP verified successfully!");
      setOtp("");
      await createAppointmentWithAuth(appointmentData);
    } catch (error) {
      toast.error("OTP verification failed. Please try again.");
      setOtp("");
    }
  };

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

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthStage("login");
    setOtp("");
  };

  const handleSuccessModalClose = () => {
    setIsSuccessModalOpen(false);
  };

  // IMPORTANT: Route to "/manage-appointment" (singular) on viewing appointments
  const handleViewAppointments = () => {
    setIsSuccessModalOpen(false);
    router.push("/manage-appointment");
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Book an Appointment</h1>

      {/* Doctor Selection */}
      <div className="mb-6">
        <Label htmlFor="doctor">Select a Doctor</Label>
        <Select
          onValueChange={(value) =>
            setSelectedDoctor(doctors.find((d) => d.id === parseInt(value)))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose your doctor" />
          </SelectTrigger>
          <SelectContent>
            {doctors.map((doctor) => (
              <SelectItem key={doctor.id} value={doctor.id.toString()}>
                {`${doctor.first_name} ${doctor.last_name}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Show booking form only after a doctor is selected */}
      {selectedDoctor && (
        <>
          {/* Doctor Profile */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Doctor Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start space-x-4">
                <Avatar className="h-24 w-24">
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
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">
                    {`${selectedDoctor.first_name} ${selectedDoctor.last_name}`}
                  </h3>
                  <p className="text-muted-foreground">{selectedDoctor.about}</p>
                  <p className="font-medium">
                    Qualifications: {selectedDoctor.qualifications}
                  </p>
                  {selectedDoctor.medicalAid && (
                    <div>
                      <p className="font-medium">Accepted Medical Aid:</p>
                      <ul className="list-disc list-inside text-sm">
                        {selectedDoctor.medicalAid.map((aid) => (
                          <li key={aid}>{aid}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedDoctor.pricing && (
                    <p className="font-medium text-primary">
                      {selectedDoctor.pricing}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Form */}
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="Enter your first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Enter your last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Cellphone Number</Label>
              <Input
                id="phone"
                placeholder="Enter your cellphone number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Appointment Date & Time</Label>
              <div className="flex flex-col sm:flex-row gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-start text-left font-normal w-full sm:w-[240px]"
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
                      disabled={{
                        before: new Date(),
                        after: addMonths(new Date(), 1),
                      }}
                    />
                  </PopoverContent>
                </Popover>

                <Select onValueChange={(value) => setAppointmentTime(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTimes.length > 0 ? (
                      availableTimes.map((time, index) => (
                        <SelectItem key={index} value={time}>
                          {time}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem disabled value="none">
                        No available times
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Questionnaire Section */}
            {isQuestionnaireEnabled &&
              questionnaireData &&
              questionnaireData.questions && (
                <MedicalQuestionnaire
                  onFormDataChange={setQuestionnaireData}
                  questionnaireFormData={questionnaireData}
                />
              )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) =>
                  setTermsAccepted(checked === true)
                }
              />
              <Label htmlFor="terms" className="text-sm">
                I agree to the terms and conditions and consent to the processing
                of my personal information
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
