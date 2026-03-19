import Svg, { Path } from 'react-native-svg';

interface GoogleMarkProps {
  size?: number;
}

export default function GoogleMark({ size = 18 }: GoogleMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.74 1.22 9.25 3.6l6.9-6.9C35.98 2.28 30.45 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.03 6.24C12.5 13.41 17.76 9.5 24 9.5Z"
      />
      <Path
        fill="#4285F4"
        d="M46.5 24.5c0-1.57-.14-3.09-.4-4.55H24v8.63h12.64c-.55 2.94-2.22 5.43-4.73 7.11l7.65 5.94C44.04 37.5 46.5 31.56 46.5 24.5Z"
      />
      <Path
        fill="#FBBC05"
        d="M10.59 28.54A14.5 14.5 0 0 1 9.5 24c0-1.58.38-3.08 1.05-4.42l-8.03-6.24A24 24 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78l8.03-6.24Z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.92-2.15 15.9-5.81l-7.65-5.94c-2.12 1.42-4.83 2.25-8.25 2.25-6.24 0-11.5-3.91-13.41-9.42l-8.03 6.24C6.51 42.62 14.62 48 24 48Z"
      />
    </Svg>
  );
}
