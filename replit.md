# Overview

MUN Hub is a comprehensive web application designed for Model United Nations (MUN) conferences. The platform centralizes conference management by providing delegates, chairs, and administrators with tools to manage speeches, resolutions, schedules, announcements, and committee information. Built as a full-stack Next.js application, it serves as a digital hub that replaces the traditional scattered approach of using multiple platforms like Google Drives and note-taking apps.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The application uses Next.js 15 with the App Router architecture, providing server-side rendering and client-side navigation. The frontend is built with React 19 and TypeScript, utilizing Tailwind CSS for styling and Framer Motion for animations. The UI components are built using shadcn/ui components with Radix UI primitives, ensuring accessibility and consistency across the application.

## Authentication & Authorization
The system implements a role-based authentication system with three user types: delegates, chairs, and administrators. Authentication is managed through a custom session context using cookies for persistence. Protected routes are implemented through Higher-Order Components (HOCs) that restrict access based on user roles, ensuring delegates can only access delegate features, chairs can access chair tools, and admins have full system access.

## Data Management
The application uses Supabase as the primary database solution, providing PostgreSQL database functionality with real-time capabilities. Data is managed through custom hooks that handle API calls, state management, and data synchronization. The system includes comprehensive type definitions in TypeScript for all data models including users, committees, countries, speeches, and resolutions.

## Rich Text Editing
The platform integrates TipTap editor for rich text editing capabilities, particularly for speech composition and resolution drafting. The editor includes custom extensions for enhanced functionality, cursor visibility management, and mobile-responsive editing experiences. This provides users with a sophisticated document editing environment similar to modern word processors.

## State Management
State is managed through React's built-in hooks (useState, useEffect, useContext) with custom hooks for specific functionality like speech management, country selection, and modal management. The application uses a context-based approach for global state like user sessions, while local state is managed at the component level for better performance and maintainability.

## Mobile Responsiveness
The application is designed with mobile-first principles, including custom hooks for detecting mobile devices and responsive UI components. The interface adapts to different screen sizes, providing optimal user experiences across desktop, tablet, and mobile devices.

## File Management
Image uploads and file management are handled through Supabase storage integration, allowing users to upload conference updates with images and manage document repositories. The system includes proper file validation and processing capabilities.

# External Dependencies

## Database & Backend Services
- **Supabase**: Primary database (PostgreSQL) and authentication service
- **Supabase Storage**: File storage and image management

## UI & Styling
- **Tailwind CSS**: Utility-first CSS framework for styling
- **shadcn/ui**: Pre-built UI component library
- **Radix UI**: Headless UI primitives for accessibility
- **Framer Motion**: Animation library for smooth transitions
- **Lucide React**: Icon library for consistent iconography

## Rich Text Editing
- **TipTap**: Extensible rich text editor framework
- **TipTap Extensions**: Various extensions for enhanced editing features

## Development & Build Tools
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type safety and developer experience
- **React 19**: Latest React features and improvements

## Additional Libraries
- **js-cookie**: Cookie management for session persistence
- **Sonner**: Toast notification system
- **React Spring**: Animation library for parallax effects
- **Prisma**: Database toolkit and ORM (configured but may not be actively used)

The application follows a modular architecture with clear separation of concerns, making it maintainable and scalable for future enhancements. The use of TypeScript throughout ensures type safety, while the component-based architecture promotes reusability and consistent user experience.