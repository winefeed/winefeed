import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Winefeed för leverantörer - Nå nya restaurangkunder";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #FAF8F5 0%, #F0EDE8 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "16px",
              height: "16px",
              backgroundColor: "#E8DFC4",
              transform: "rotate(45deg)",
              marginRight: "-4px",
            }}
          />
          <div
            style={{
              width: "16px",
              height: "16px",
              backgroundColor: "#E8B4B8",
              transform: "rotate(45deg)",
              marginRight: "-4px",
              opacity: 0.85,
            }}
          />
          <div
            style={{
              width: "16px",
              height: "16px",
              backgroundColor: "#7A1B2D",
              transform: "rotate(45deg)",
              marginRight: "16px",
            }}
          />
          <span
            style={{
              fontSize: "32px",
              color: "#7A1B2D",
              fontWeight: 700,
            }}
          >
            winefeed
          </span>
        </div>

        <div
          style={{
            fontSize: "56px",
            fontWeight: 700,
            color: "#161412",
            lineHeight: 1.2,
            marginBottom: "16px",
          }}
        >
          Nå nya restaurangkunder
        </div>

        <div
          style={{
            fontSize: "24px",
            color: "#828181",
            lineHeight: 1.5,
            maxWidth: "800px",
          }}
        >
          Gratis att lista sig. Ta emot förfrågningar och svara med offert. 4 %
          success fee på accepterade ordrar.
        </div>

        <div
          style={{
            marginTop: "40px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              backgroundColor: "#722F37",
              color: "white",
              padding: "12px 28px",
              borderRadius: "8px",
              fontSize: "20px",
              fontWeight: 600,
            }}
          >
            Bli leverantör
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
