
import { IconProps } from "@/types/IconProps";

export default function WalletIcon({
    width = 24,
    height = 24,
    className = "",
}: IconProps) {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <path
                d="M19 8.5V17C19 19.2091 17.2091 21 15 21H6C3.79086 21 2 19.2091 2 17V7C2 4.79086 3.79086 3 6 3H14M19 8.5C20.6569 8.5 22 9.84315 22 11.5V14C22 15.6569 20.6569 17 19 17M19 8.5V17"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M14 3L19 8.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="17.5" cy="12.5" r="1.5" fill="currentColor" />
        </svg>
    )
}