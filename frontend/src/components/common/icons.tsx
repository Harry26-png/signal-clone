import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

const icon = (paths: ReactNode) =>
  function Icon(props: IconProps) {
    return <Svg {...props}>{paths}</Svg>;
  };

export const ChatsIcon = icon(
  <path d="M12 3.75c4.83 0 8.75 3.47 8.75 7.75S16.83 19.25 12 19.25c-1.1 0-2.15-.18-3.12-.5L4.5 20.5l1.15-3.86C4.43 15.28 3.25 13.47 3.25 11.5c0-4.28 3.92-7.75 8.75-7.75z" />,
);
export const PhoneIcon = icon(
  <path d="M8.2 3.75H5.6c-1 0-1.85.8-1.85 1.82C3.75 13.4 10.6 20.25 18.43 20.25c1.02 0 1.82-.84 1.82-1.85v-2.6c0-.6-.38-1.12-.95-1.3l-2.9-.95c-.5-.16-1.05-.03-1.42.34l-1.4 1.4a12.6 12.6 0 0 1-4.9-4.9l1.4-1.4c.37-.37.5-.92.34-1.42l-.95-2.9a1.37 1.37 0 0 0-1.3-.95z" />,
);
export const StoriesIcon = icon(
  <>
    <path d="M12 3.25a8.75 8.75 0 0 1 0 17.5" />
    <path d="M12 20.75a8.75 8.75 0 0 1-6.19-14.94" strokeDasharray="2 2.6" />
    <circle cx="12" cy="12" r="4.75" />
  </>,
);
export const SettingsIcon = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>,
);
export const ComposeIcon = icon(
  <>
    <path d="M11 4.75H6.75a2 2 0 0 0-2 2v10.5a2 2 0 0 0 2 2h10.5a2 2 0 0 0 2-2V13" />
    <path d="M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7L12.5 14.4l-3.4.7.7-3.4z" />
  </>,
);
export const MoreIcon = (props: IconProps) => (
  <Svg {...props} fill="currentColor" stroke="none">
    <circle cx="5.5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="18.5" cy="12" r="1.6" />
  </Svg>
);
export const SearchIcon = icon(
  <>
    <circle cx="10.75" cy="10.75" r="6.5" />
    <path d="m15.5 15.5 4.75 4.75" />
  </>,
);
export const FilterIcon = icon(<path d="M4 6.5h16M7 12h10M10 17.5h4" />);
export const BackIcon = icon(<path d="M15 5.5 8.5 12l6.5 6.5" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6 6 18" />);
export const ChevronRightIcon = icon(<path d="m9.5 6 6 6-6 6" />);
export const CheckIcon = icon(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const VideoIcon = icon(
  <>
    <rect x="3.25" y="6.25" width="12.5" height="11.5" rx="2.5" />
    <path d="m15.75 10.25 5-3v9.5l-5-3" />
  </>,
);
export const EmojiIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path d="M8.5 14.25c.8 1.25 2.06 2 3.5 2s2.7-.75 3.5-2" />
    <circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none" />
  </>,
);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const PlusCircleIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path d="M12 8v8M8 12h8" />
  </>,
);
export const MicIcon = icon(
  <>
    <rect x="8.75" y="3.25" width="6.5" height="11" rx="3.25" />
    <path d="M5.75 11.5a6.25 6.25 0 0 0 12.5 0M12 17.75v3" />
  </>,
);
export const SendIcon = (props: IconProps) => (
  <Svg {...props} fill="currentColor" stroke="none">
    <path d="M4.4 3.6a.9.9 0 0 0-1.25 1.06L5.2 11.3h7.3a.7.7 0 1 1 0 1.4H5.2l-2.05 6.64A.9.9 0 0 0 4.4 20.4l16.2-7.6a.9.9 0 0 0 0-1.62z" />
  </Svg>
);
export const GroupIcon = icon(
  <>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3.25 19c.4-3.15 2.75-5.25 5.75-5.25s5.35 2.1 5.75 5.25" />
    <path d="M15.25 5.5a3.25 3.25 0 0 1 0 6.2M17 13.9c2.1.5 3.5 2.4 3.75 5.1" />
  </>,
);
export const PersonIcon = icon(
  <>
    <circle cx="12" cy="8.25" r="3.75" />
    <path d="M4.75 20c.6-3.7 3.5-6.25 7.25-6.25S18.65 16.3 19.25 20" />
  </>,
);
export const AddPersonIcon = icon(
  <>
    <circle cx="10" cy="8.25" r="3.75" />
    <path d="M3 20c.6-3.7 3.4-6.25 7-6.25 1.4 0 2.7.38 3.75 1.06M18.5 13.5v6M15.5 16.5h6" />
  </>,
);
export const AtIcon = icon(
  <>
    <circle cx="12" cy="12" r="3.75" />
    <path d="M15.75 8.25v5c0 1.5 1 2.5 2.25 2.5s2.25-1 2.25-3.75a8.25 8.25 0 1 0-3.4 6.68" />
  </>,
);
export const HashIcon = icon(<path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15.5M4 15h15.5" />);
export const TimerIcon = icon(
  <>
    <circle cx="12" cy="13" r="7.75" />
    <path d="M12 9v4l2.5 2M9.75 2.75h4.5" />
  </>,
);
export const LockIcon = icon(
  <>
    <rect x="5" y="10.25" width="14" height="10" rx="2" />
    <path d="M8.25 10.25V7.5a3.75 3.75 0 0 1 7.5 0v2.75" />
  </>,
);
export const ShieldIcon = icon(
  <>
    <path d="M12 3.25 4.75 6v5.5c0 4.4 3.05 8.1 7.25 9.25 4.2-1.15 7.25-4.85 7.25-9.25V6z" />
    <path d="m9 12 2.2 2.2L15.25 10" />
  </>,
);
export const ReplyIcon = icon(<path d="M9.5 6.5 4.75 11l4.75 4.5M5 11h9.25c3.04 0 5 2.2 5 5.25v1.5" />);
export const CopyIcon = icon(
  <>
    <rect x="8.25" y="8.25" width="11.5" height="11.5" rx="2" />
    <path d="M15.75 8.25V6.25a2 2 0 0 0-2-2h-7.5a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2" />
  </>,
);
export const LeaveIcon = icon(
  <>
    <path d="M13.75 4.75h-6.5a2 2 0 0 0-2 2v10.5a2 2 0 0 0 2 2h6.5" />
    <path d="M10.75 12h9.5M17 8.75 20.25 12 17 15.25" />
  </>,
);
export const TrashIcon = icon(
  <path d="M4.75 6.75h14.5M9.75 6.75V5a1.25 1.25 0 0 1 1.25-1.25h2A1.25 1.25 0 0 1 14.25 5v1.75M6.5 6.75l.85 12.1a1.5 1.5 0 0 0 1.5 1.4h6.3a1.5 1.5 0 0 0 1.5-1.4l.85-12.1" />,
);
export const BellIcon = icon(
  <path d="M6.25 16.75V10.5a5.75 5.75 0 0 1 11.5 0v6.25l1.5 1.5H4.75zM10 20.25a2.1 2.1 0 0 0 4 0" />,
);
export const PaletteIcon = icon(
  <>
    <path d="M12 3.25a8.75 8.75 0 0 0 0 17.5c1.1 0 1.75-.75 1.75-1.6 0-.95-.75-1.3-.75-2.15 0-.95.8-1.75 1.75-1.75h2.25a3.75 3.75 0 0 0 3.75-3.75c0-4.5-3.9-8.25-8.75-8.25z" />
    <circle cx="7.75" cy="11.25" r="1" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7.75" r="1" fill="currentColor" stroke="none" />
  </>,
);
export const DevicesIcon = icon(
  <>
    <rect x="2.75" y="5.25" width="13.5" height="9.5" rx="1.5" />
    <path d="M6.5 18.75h6M9.5 14.75v4" />
    <rect x="17.25" y="8.25" width="4" height="10.5" rx="1" />
  </>,
);
export const SlidersIcon = icon(
  <path d="M4.75 7.25h8.5M17.25 7.25h2M4.75 16.75h2M10.75 16.75h8.5M15.25 5v4.5M8.75 14.5V19" />,
);
export const KeyboardIcon = icon(
  <>
    <rect x="2.75" y="6.25" width="18.5" height="11.5" rx="2" />
    <path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8" />
  </>,
);
export const CameraIcon = icon(
  <>
    <path d="M4.75 7.75h3l1.5-2.5h5.5l1.5 2.5h3a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H4.75a1.5 1.5 0 0 1-1.5-1.5v-8.5a1.5 1.5 0 0 1 1.5-1.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </>,
);
export const FileIcon = icon(
  <>
    <path d="M13.25 3.25H7.25a2 2 0 0 0-2 2v13.5a2 2 0 0 0 2 2h9.5a2 2 0 0 0 2-2v-10z" />
    <path d="M13.25 3.25v5.5h5.5" />
  </>,
);
export const LogoutIcon = LeaveIcon;
export const ArrowDownIcon = icon(<path d="M12 5v14M6 13l6 6 6-6" />);
export const ArrowRightIcon = icon(<path d="M5 12h14M13 6l6 6-6 6" />);
export const InfoIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path d="M12 11v5.25M12 7.75h.01" />
  </>,
);
export const EditIcon = icon(<path d="M15.6 4.9a2.1 2.1 0 0 1 3 3L8.5 18l-4 1 1-4z" />);
export const ChatColorIcon = PaletteIcon;
