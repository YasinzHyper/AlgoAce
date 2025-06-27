"use client";

export default function ContactUs() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
      <p className="mb-4">We'd love to hear from you! Whether you have questions, feedback, or partnership inquiries, please reach out using the information below.</p>
      <h2 className="text-xl font-semibold mt-8 mb-2">Email</h2>
      <p className="mb-4">For support or general inquiries: <a href="mailto:support@algoace.com" className="text-blue-600 underline">support@algoace.com</a></p>
      <h2 className="text-xl font-semibold mt-8 mb-2">Feedback</h2>
      <p className="mb-4">Have suggestions or found a bug? Let us know and help us improve AlgoAce for everyone!</p>
      <h2 className="text-xl font-semibold mt-8 mb-2">Social</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>Twitter: <a href="https://twitter.com/algoace" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">@algoace</a></li>
        <li>GitHub: <a href="https://github.com/algoace" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">algoace</a></li>
      </ul>
      <h2 className="text-xl font-semibold mt-8 mb-2">Business & Partnerships</h2>
      <p>For business or partnership opportunities, email <a href="mailto:business@algoace.com" className="text-blue-600 underline">business@algoace.com</a></p>
    </div>
  );
}
