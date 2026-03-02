import { useState } from "react";
import axios from "axios";

export default function CreateTicket() {
  const [form, setForm] = useState({
    customerName: "",
    siteName: "",
    issueDetails: "",
    assignedTo: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submitTicket = async () => {
    await axios.post("http://localhost:5000/api/tickets/create", form);
    alert("Ticket Created Successfully!");
  };

  return (
    <div>
      <h2>Create Support Ticket</h2>

      <input
        name="customerName"
        placeholder="Customer Name"
        onChange={handleChange}
      />

      <input
        name="siteName"
        placeholder="Site Name"
        onChange={handleChange}
      />

      <textarea
        name="issueDetails"
        placeholder="Issue Details"
        onChange={handleChange}
      />

      <input
        name="assignedTo"
        placeholder="Assigned To"
        onChange={handleChange}
      />

      <button onClick={submitTicket}>Submit Ticket</button>
    </div>
  );
}
