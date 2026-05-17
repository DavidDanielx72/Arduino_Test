#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>

//WiFi Credentials
const char* WIFI_SSID     = "RG-1001-1231";
const char* WIFI_PASSWORD = "326266fd93";

//Server URL
const char* SERVER_URL = "http://192.168.18.158:3000/event";
const char* COMMAND_URL = "http://192.168.18.158:3000/command";

//RFID Pins
#define SS_PIN   5
#define RST_PIN  21

//Ultrasonic Sensor Pins
#define TRIG_PIN 13
#define ECHO_PIN 12

//Buzzer Pin
#define BUZZER_PIN 25

//Alarm Settings
#define TRIGGER_DISTANCE 40
#define BEEP_INTERVAL    300
#define POST_INTERVAL    5000

//Authorised RFID UIDs
const byte AUTHORISED_CARDS[][4] = {
  { 0x00, 0xB9, 0xC9, 0x60 },
};
const int NUM_CARDS = sizeof(AUTHORISED_CARDS) / sizeof(AUTHORISED_CARDS[0]);

//State
bool alarmArmed     = true;
bool alarmTriggered = false;
unsigned long lastBeep = 0;
unsigned long lastPost = 0;

MFRC522 rfid(SS_PIN, RST_PIN);

// SERVER RECOVERY TRACKER

unsigned long lastServerCheck = 0;

// SERVER BOOT CHECK
bool waitForServer() {

  HTTPClient http;

  for (int i = 0; i < 10; i++) {

    http.begin(COMMAND_URL);
    int code = http.GET();
    http.end();

    if (code == 200) {
      Serial.println("Server ready!");
      return true;
    }

    Serial.println("Waiting for server...");
    delay(1000);
  }

  return false;
}

// =====================================================

void checkServerCommand() {

  HTTPClient http;
  http.begin(COMMAND_URL);

  int code = http.GET();

  if (code == 200) {

    String payload = http.getString();

    if (payload.indexOf("disarmed") > -1) {
      alarmArmed = false;
    } 
    else if (payload.indexOf("armed") > -1) {
      alarmArmed = true;
    }
  }

  http.end();
}

long readDistance() {

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) return -1;

  return (duration / 2) / 29.1;
}

void soundAlarm() {

  unsigned long now = millis();

  if (now - lastBeep >= BEEP_INTERVAL) {
    digitalWrite(BUZZER_PIN, !digitalRead(BUZZER_PIN));
    lastBeep = now;
  }
}

void checkRFID() {

  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  String uid = "";

  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += ":";
  }

  uid.toUpperCase();

  Serial.print("Card tapped: ");
  Serial.println(uid);

  if (isAuthorised(rfid.uid.uidByte, rfid.uid.size)) {

    alarmTriggered = false;
    digitalWrite(BUZZER_PIN, LOW);

    String newStatus = "toggle";

    Serial.println(">> RFID REQUEST TOGGLE");

    postEvent("rfid_tap", newStatus, -1, uid);

  } else {

    Serial.println(">> Unauthorised card — ignored");

    postEvent("rfid_tap", "unauthorised", -1, uid);
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(500);
}

bool isAuthorised(byte *uid, byte uidSize) {

  for (int i = 0; i < NUM_CARDS; i++) {

    bool match = true;

    for (byte b = 0; b < 4; b++) {
      if (uid[b] != AUTHORISED_CARDS[i][b]) {
        match = false;
        break;
      }
    }

    if (match) return true;
  }

  return false;
}

void postEvent(String type, String status, long distance, String cardUID) {

  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String body = "{";
  body += "\"type\":\"" + type + "\",";
  body += "\"status\":\"" + status + "\",";
  body += "\"distance\":" + String(distance);

  if (cardUID.length() > 0)
    body += ",\"cardUID\":\"" + cardUID + "\"";

  body += "}";

  int code = http.POST(body);

  if (code > 0) {
    Serial.print("POST -> HTTP ");
    Serial.println(code);
  } else {
    Serial.println("POST FAILED (no response from server)");
  }

  http.end();
}

// MAIN CODE 

void setup() {

  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("Connected! IP: ");
  Serial.println(WiFi.localIP());

  //STABILITY DELAY
  delay(3000);

  SPI.begin();
  rfid.PCD_Init();

  // FIXED BOOT FLOW
  if (waitForServer()) {
    postEvent("status", "armed", -1, "");
  } else {
    Serial.println("Server not reachable on boot");
  }
}

void loop() {

  checkServerCommand();
  checkRFID();

  // SERVER RECOVERY LOOP
  if (millis() - lastServerCheck > 10000) {

    if (WiFi.status() == WL_CONNECTED) {

      HTTPClient http;
      http.begin(COMMAND_URL);

      int code = http.GET();

      if (code == 200) {
        Serial.println("Server reachable (loop check)");
      } else {
        Serial.println("Server NOT reachable");
      }

      http.end();
    }

    lastServerCheck = millis();
  }

  if (alarmArmed) {

    long distance = readDistance();

    if (millis() - lastPost >= POST_INTERVAL) {
      postEvent("distance", "armed", distance, "");
      lastPost = millis();
    }

    if (distance > 0 && distance <= TRIGGER_DISTANCE) {
      if (!alarmTriggered) {
        alarmTriggered = true;
        postEvent("intrusion", "armed", distance, "");
      }
    }

  } else {
    alarmTriggered = false;
    digitalWrite(BUZZER_PIN, LOW);
  }

  if (alarmTriggered) {
    soundAlarm();
  }

  delay(100);
}