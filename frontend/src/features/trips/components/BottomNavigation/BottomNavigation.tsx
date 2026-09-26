import { NavLink } from "react-router-dom";

export function BottomNavigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#e0e0e0] rounded-t-[50px] lg:hidden">
      <div className="relative flex items-end justify-around h-20">
        <NavLink
          to="/trips"
          className="flex flex-col items-center justify-center p-3 rounded-lg"
        >
          <svg
            className="h-9 w-9"
            fill="currentColor"
            viewBox="0 0 512 512"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path fillRule="evenodd" d="M128 298.666c23.564 0 42.667 19.103 42.667 42.667S151.564 384 128 384s-42.666-19.103-42.666-42.667s19.102-42.667 42.666-42.667m245.334 0c23.564 0 42.666 19.103 42.666 42.667S396.898 384 373.334 384s-42.667-19.103-42.667-42.667s19.103-42.667 42.667-42.667m-88.89-149.333l5.69 4.267l81.856 61.397l65.025 16.266c17.877 4.47 30.731 19.85 32.182 37.966l.137 3.427v74.667l-16.16 4.04l-17.466 4.367a64.2 64.2 0 0 0 1.626-14.397c0-35.346-28.654-64-64-64s-64 28.654-64 64c0 7.48 1.283 14.661 3.642 21.334H188.358A63.9 63.9 0 0 0 192 341.333c0-35.346-28.653-64-64-64c-35.346 0-64 28.654-64 64c0 3.244.242 6.431.707 9.545l-22.04-22.042V226.943l4.945-5.934l53.333-64l6.397-7.676zM270.23 192H127.318l-35.55 42.666h206.899l12.192-12.192z" />
          </svg>
          <span className="text-nav-label font-body text-black mt-0.5">
            Trips
          </span>
        </NavLink>

        <NavLink
          to="/trips/new"
          className="flex items-center justify-center rounded-full w-20 h-20 text-black btn-secondary absolute left-1/2 -translate-x-1/2 -top-10 border-4 border-[#e0e0e0]"
        >
          <svg
            className="h-10 w-10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 5v14m7-7H5"
            />
          </svg>
        </NavLink>

        <NavLink
          to="/profile"
          className="flex flex-col items-center justify-center p-3 text-black"
        >
          <svg
            className="h-8 w-8"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M8 7a4 4 0 1 1 8 0a4 4 0 0 1-8 0m0 6a5 5 0 0 0-5 5a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3a5 5 0 0 0-5-5z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-nav-label font-body text-black mt-0.5">
            Profile
          </span>
        </NavLink>
      </div>
    </nav>
  );
}
