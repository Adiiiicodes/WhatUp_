# WhatUp - A Real-Time Chat Application

WhatUp is a full-stack, real-time chat application built with Next.js and MongoDB. It provides a seamless and interactive chatting experience with features like user authentication, private messaging, and file sharing. This project serves as a demonstration of building modern, scalable, and real-time web applications with the Next.js App Router.

## Features

- **User Authentication:**
  - Secure user registration with email and password.
  - Robust login system with password hashing using `bcryptjs`.
  - Social login with Google OAuth 2.0.
  - Stateless session management using `iron-session` for enhanced security.
  - Protected routes to ensure only authenticated users can access the chat features.

- **Real-Time Chat:**
  - One-to-one private conversations between users.
  - A responsive chat interface with a sidebar listing all conversations.
  - A dynamic chat window for sending and receiving messages in real-time.
  - User presence indicators to show who is online or offline.
  - Display of the user's last seen time.

- **File Sharing:**
  - Seamlessly upload and share various file types, including images, documents, and voice notes.
  - Efficient storage and retrieval of large files using MongoDB's GridFS.
  - Automatic image compression on upload using `sharp` to save storage space and improve performance.

- **Signaling for WebRTC:**
  - Includes a basic signaling server with API endpoints for sending and receiving signaling messages. This lays the groundwork for future WebRTC features like voice and video calls.


## Tech Stack

This project is built with a modern and powerful tech stack:

- **Framework:** [Next.js](https://nextjs.org/) (v15) - A React framework for building server-side rendered and static web applications.
- **Language:** [TypeScript](https://www.typescriptlang.org/) - For static typing, leading to more robust and maintainable code.
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework for rapid UI development.
- **Database:** [MongoDB](https://www.mongodb.com/) - A flexible NoSQL database for storing application data.
  - **ODM:** [Mongoose](https://mongoosejs.com/) - An Object Data Modeling (ODM) library for MongoDB, providing a schema-based solution to model application data.
  - **File Storage:** [GridFS](https://docs.mongodb.com/manual/core/gridfs/) - A MongoDB specification for storing and retrieving large files.
- **Authentication:**
  - [iron-session](https://github.com/vvo/iron-session) - For creating and managing stateless, encrypted session data.
  - [bcryptjs](https://github.com/dcodeIO/bcrypt.js) - For hashing passwords before storing them in the database.
  - [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2) - For implementing "Log in with Google" functionality.
- **UI Components:**
  - [React](https://reactjs.org/) - For building the user interface.
  - [Lucide React](https://lucide.dev/guide/packages/lucide-react) - For beautiful and consistent icons.
- **File Handling:**
  - [sharp](https://sharp.pixelplumbing.com/) - For fast and efficient image processing and compression.
- **Linting & Formatting:**
  - [ESLint](https://eslint.org/) - To enforce code quality and consistency.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or later)
- [npm](https://www.npmjs.com/)
- A [MongoDB](https://www.mongodb.com/try/download/community) database instance (local or remote).
- A Google Cloud project with OAuth 2.0 credentials.

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/your-username/whatup.git
   cd whatup
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file in the root of the project and add the following environment variables. Replace the placeholder values with your actual credentials.

   ```env
   # A secret key for session encryption. Must be at least 32 characters long.
   SESSION_SECRET="your_super_secret_password_that_is_at_least_32_characters_long"

   # Your MongoDB connection string.
   MONGODB_URI="mongodb://localhost:27017/whatup"

   # Google OAuth 2.0 credentials
   GOOGLE_CLIENT_ID="your_google_client_id"
   GOOGLE_CLIENT_SECRET="your_google_client_secret"
   GOOGLE_OAUTH_REDIRECT="http://localhost:3000/api/auth/google/callback"
   ```

### Running the Application

- **Development:**
  ```sh
  npm run dev
  ```
  Open [http://localhost:3000](http://localhost:3000) to view the application in your browser.

- **Build:**
  ```sh
  npm run build
  ```

- **Production:**
  ```sh
  npm run start
  ```

## Project Structure

The project follows a standard Next.js App Router structure:

```
/
├── public/               # Static assets
├── src/
│   ├── app/              # App Router pages and API routes
│   │   ├── api/          # API routes
│   │   ├── (main)/       # Main application routes and layouts
│   │   └── layout.tsx    # Root layout
│   ├── components/       # Reusable React components
│   │   ├── ui/           # Generic UI components (e.g., Button)
│   │   ├── auth/         # Authentication-related components
│   │   └── chat/         # Chat-specific components
│   ├── lib/              # Helper functions and utility modules
│   ├── models/           # Mongoose models for the database schema
│   └── types/            # TypeScript type definitions
├── .env.local.example    # Example environment variables
├── next.config.ts        # Next.js configuration
└── package.json          # Project dependencies and scripts
```

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Your Name - [@scriptSageAdi](https://x.com/scriptSageAdi?t=VRXgWt61Rd9QOzee7rwj2w&s=08) -   nalawadeaditya017@gmail.com

Project Link: [https://github.com/Adiiiicodes/whatup](https://github.com/Adiiiicodes/whatup)
```