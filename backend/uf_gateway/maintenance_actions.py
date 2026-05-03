"""
Rasa SDK actions for AzaBot maintenance request operations.

Install this module inside the Rasa actions server and import/register these
classes from the active actions package. The actions use backend/uf_gateway/client.py
and require BOT_API_KEY on the server environment.
"""

from __future__ import annotations

import re
from typing import Any, Text

from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet

from .client import UFGatewayClient, UFGatewayConfigurationError, UFGatewayRequestError


SERVICE_ALIASES = {
    "سباكة": "plumbing",
    "سباكه": "plumbing",
    "plumbing": "plumbing",
    "كهرباء": "electrical",
    "كهربا": "electrical",
    "electrical": "electrical",
    "تكييف": "ac",
    "تكيف": "ac",
    "ac": "ac",
    "دهانات": "painting",
    "نقاشة": "painting",
    "painting": "painting",
    "نجارة": "carpentry",
    "carpentry": "carpentry",
    "نظافة": "cleaning",
    "cleaning": "cleaning",
    "عام": "general",
    "صيانة عامة": "general",
    "general": "general",
    "أجهزة": "appliance",
    "اجهزة": "appliance",
    "appliance": "appliance",
    "مكافحة حشرات": "pest_control",
    "pest_control": "pest_control",
    "لاندسكيب": "landscaping",
    "landscaping": "landscaping",
    "تشطيب": "finishing",
    "finishing": "finishing",
    "تجديد": "renovation",
    "renovation": "renovation",
}

PRIORITY_ALIASES = {
    "منخفض": "low",
    "عادي": "medium",
    "متوسط": "medium",
    "مهم": "high",
    "عاجل": "urgent",
    "طارئ": "urgent",
    "low": "low",
    "medium": "medium",
    "high": "high",
    "urgent": "urgent",
}

REQUEST_NUMBER_PATTERN = re.compile(r"UF/MR/\d{6}/\d{4}", re.IGNORECASE)
PHONE_PATTERN = re.compile(r"(?:\+?20|0)?1[0125]\d{8}")


class ActionMaintenanceListServices(Action):
    def name(self) -> Text:
        return "action_maintenance_list_services"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: dict[Text, Any]) -> list[dict[Text, Any]]:
        try:
            response = UFGatewayClient().list_services()
        except (UFGatewayConfigurationError, UFGatewayRequestError) as exc:
            dispatcher.utter_message(text=f"تعذر تحميل خدمات الصيانة الآن: {exc}")
            return []

        services = _extract_items(response)
        if not services:
            dispatcher.utter_message(text="لم أستطع قراءة قائمة الخدمات من بوابة الصيانة الآن.")
            return []

        lines = ["خدمات الصيانة المتاحة حالياً:"]
        for item in services[:20]:
            key = item.get("key") or item.get("id") or ""
            label = item.get("label") or item.get("name") or key
            lines.append(f"- {label} `{key}`")
        dispatcher.utter_message(text="\n".join(lines))
        return []


class ActionMaintenanceCreateRequest(Action):
    def name(self) -> Text:
        return "action_maintenance_create_request"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: dict[Text, Any]) -> list[dict[Text, Any]]:
        payload = _build_create_payload(tracker)
        missing = _missing_required_create_fields(payload)
        if missing:
            dispatcher.utter_message(text=_missing_fields_message(missing))
            return []

        try:
            response = UFGatewayClient().create_request(payload, session_id=tracker.sender_id)
        except (UFGatewayConfigurationError, UFGatewayRequestError) as exc:
            dispatcher.utter_message(text=f"تعذر إنشاء طلب الصيانة الآن: {exc}")
            return []

        if response.get("success") is False:
            dispatcher.utter_message(text=f"لم يتم إنشاء الطلب: {response.get('error') or response.get('message') or 'خطأ غير معروف'}")
            return []

        data = response.get("data") if isinstance(response.get("data"), dict) else response
        request_id = data.get("request_id") or data.get("id")
        request_number = data.get("tracking_number") or data.get("request_number")

        message = "تم إنشاء طلب الصيانة بنجاح."
        if request_number:
            message += f"\nرقم المتابعة: {request_number}"
        dispatcher.utter_message(text=message)

        events: list[dict[Text, Any]] = []
        if request_id:
            events.append(SlotSet("maintenance_request_id", request_id))
        if request_number:
            events.append(SlotSet("maintenance_request_number", request_number))
        if payload.get("client_phone"):
            events.append(SlotSet("client_phone", payload["client_phone"]))
        return events


class ActionMaintenanceCheckStatus(Action):
    def name(self) -> Text:
        return "action_maintenance_check_status"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: dict[Text, Any]) -> list[dict[Text, Any]]:
        search_term = _slot_or_entity(tracker, "maintenance_request_number", "request_number")
        if not search_term:
            search_term = _extract_request_number(tracker.latest_message.get("text") or "")
        if not search_term:
            search_term = _slot_or_entity(tracker, "client_phone", "phone")
        if not search_term:
            dispatcher.utter_message(text="أرسل رقم الطلب مثل UF/MR/260502/0042 أو رقم هاتف العميل للاستعلام.")
            return []

        search_type = "request_number" if _extract_request_number(search_term) else "phone"
        try:
            response = UFGatewayClient().check_status(search_term, search_type)
        except (UFGatewayConfigurationError, UFGatewayRequestError) as exc:
            dispatcher.utter_message(text=f"تعذر الاستعلام عن الطلب الآن: {exc}")
            return []

        dispatcher.utter_message(text=_format_status_response(response))
        return []


class ActionMaintenanceGetDetails(Action):
    def name(self) -> Text:
        return "action_maintenance_get_details"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: dict[Text, Any]) -> list[dict[Text, Any]]:
        request_number = _slot_or_entity(tracker, "maintenance_request_number", "request_number")
        if not request_number:
            request_number = _extract_request_number(tracker.latest_message.get("text") or "")
        phone = _slot_or_entity(tracker, "client_phone", "phone")

        if not request_number:
            dispatcher.utter_message(text="أرسل رقم الطلب حتى أعرض التفاصيل الكاملة.")
            return []

        try:
            response = UFGatewayClient().get_request_details(request_number, phone)
        except (UFGatewayConfigurationError, UFGatewayRequestError) as exc:
            dispatcher.utter_message(text=f"تعذر جلب تفاصيل الطلب الآن: {exc}")
            return []

        dispatcher.utter_message(text=_format_details_response(response))
        return []


class ActionMaintenanceUpdateRequest(Action):
    def name(self) -> Text:
        return "action_maintenance_update_request"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: dict[Text, Any]) -> list[dict[Text, Any]]:
        request_id = _slot_or_entity(tracker, "maintenance_request_id", "request_id")
        phone = _slot_or_entity(tracker, "client_phone", "phone")
        updates = _build_update_payload(tracker)

        if not request_id or not phone or not updates:
            dispatcher.utter_message(text="لتعديل الطلب أحتاج: معرف الطلب، رقم هاتف العميل، والبيانات المطلوب تعديلها.")
            return []

        try:
            response = UFGatewayClient().update_request(request_id, phone, updates)
        except (UFGatewayConfigurationError, UFGatewayRequestError) as exc:
            dispatcher.utter_message(text=f"تعذر تعديل الطلب الآن: {exc}")
            return []

        if response.get("success") is False:
            dispatcher.utter_message(text=f"لم يتم تعديل الطلب: {response.get('error') or response.get('message') or 'خطأ غير معروف'}")
            return []
        dispatcher.utter_message(text="تم تعديل بيانات طلب الصيانة بنجاح.")
        return []


class ActionMaintenanceCancelRequest(Action):
    def name(self) -> Text:
        return "action_maintenance_cancel_request"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: dict[Text, Any]) -> list[dict[Text, Any]]:
        request_id = _slot_or_entity(tracker, "maintenance_request_id", "request_id")
        phone = _slot_or_entity(tracker, "client_phone", "phone")
        reason = _slot_or_entity(tracker, "cancel_reason", "cancel_reason") or "تم طلب الإلغاء من خلال البوت"

        if not request_id or not phone:
            dispatcher.utter_message(text="لإلغاء الطلب أحتاج معرف الطلب ورقم هاتف العميل للتحقق.")
            return []

        try:
            response = UFGatewayClient().cancel_request(request_id, phone, reason)
        except (UFGatewayConfigurationError, UFGatewayRequestError) as exc:
            dispatcher.utter_message(text=f"تعذر إلغاء الطلب الآن: {exc}")
            return []

        if response.get("success") is False:
            dispatcher.utter_message(text=f"لم يتم إلغاء الطلب: {response.get('error') or response.get('message') or 'خطأ غير معروف'}")
            return []
        dispatcher.utter_message(text="تم تسجيل إلغاء طلب الصيانة بنجاح.")
        return []


class ActionMaintenanceAddNote(Action):
    def name(self) -> Text:
        return "action_maintenance_add_note"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: dict[Text, Any]) -> list[dict[Text, Any]]:
        request_id = _slot_or_entity(tracker, "maintenance_request_id", "request_id")
        note = _slot_or_entity(tracker, "maintenance_note", "note") or tracker.latest_message.get("text")
        phone = _slot_or_entity(tracker, "client_phone", "phone")

        if not request_id or not note:
            dispatcher.utter_message(text="لإضافة ملاحظة أحتاج معرف الطلب ونص الملاحظة.")
            return []

        try:
            response = UFGatewayClient().add_note(request_id, note, phone)
        except (UFGatewayConfigurationError, UFGatewayRequestError) as exc:
            dispatcher.utter_message(text=f"تعذر إضافة الملاحظة الآن: {exc}")
            return []

        if response.get("success") is False:
            dispatcher.utter_message(text=f"لم يتم إضافة الملاحظة: {response.get('error') or response.get('message') or 'خطأ غير معروف'}")
            return []
        dispatcher.utter_message(text="تمت إضافة الملاحظة على طلب الصيانة.")
        return []


def _build_create_payload(tracker: Tracker) -> dict[str, Any]:
    text = tracker.latest_message.get("text") or ""
    return {
        "client_name": _slot_or_entity(tracker, "client_name", "client_name"),
        "client_phone": _normalize_phone(_slot_or_entity(tracker, "client_phone", "phone") or _extract_phone(text)),
        "client_email": _slot_or_entity(tracker, "client_email", "email"),
        "location": _slot_or_entity(tracker, "location", "location"),
        "service_type": _normalize_service(_slot_or_entity(tracker, "service_type", "service_type") or text),
        "title": _slot_or_entity(tracker, "maintenance_title", "title") or "طلب صيانة من عزبوت",
        "description": _slot_or_entity(tracker, "maintenance_description", "description") or text,
        "priority": _normalize_priority(_slot_or_entity(tracker, "priority", "priority") or "medium"),
        "latitude": _slot_or_entity(tracker, "latitude", "latitude"),
        "longitude": _slot_or_entity(tracker, "longitude", "longitude"),
    }


def _build_update_payload(tracker: Tracker) -> dict[str, Any]:
    updates: dict[str, Any] = {}
    for slot_name, field_name in (
        ("maintenance_description", "description"),
        ("location", "location"),
        ("priority", "priority"),
        ("service_type", "service_type"),
        ("customer_notes", "customer_notes"),
        ("latitude", "latitude"),
        ("longitude", "longitude"),
        ("maintenance_title", "title"),
    ):
        value = tracker.get_slot(slot_name)
        if value not in (None, ""):
            if field_name == "priority":
                value = _normalize_priority(str(value))
            if field_name == "service_type":
                value = _normalize_service(str(value))
            updates[field_name] = value
    return updates


def _missing_required_create_fields(payload: dict[str, Any]) -> list[str]:
    required = {
        "client_name": "اسم العميل",
        "client_phone": "رقم الهاتف",
        "location": "العنوان",
        "service_type": "نوع الخدمة",
        "description": "وصف المشكلة",
    }
    return [label for key, label in required.items() if not payload.get(key)]


def _missing_fields_message(fields: list[str]) -> str:
    return "لإنشاء طلب الصيانة أحتاج البيانات التالية:\n- " + "\n- ".join(fields)


def _slot_or_entity(tracker: Tracker, slot_name: str, entity_name: str) -> str | None:
    value = tracker.get_slot(slot_name)
    if value not in (None, ""):
        return str(value).strip()
    entity = next(tracker.get_latest_entity_values(entity_name), None)
    if entity not in (None, ""):
        return str(entity).strip()
    return None


def _normalize_service(value: str | None) -> str | None:
    if not value:
        return None
    value_lower = value.strip().lower()
    if value_lower in SERVICE_ALIASES:
        return SERVICE_ALIASES[value_lower]
    for alias, service_key in SERVICE_ALIASES.items():
        if alias in value_lower:
            return service_key
    return None


def _normalize_priority(value: str | None) -> str:
    if not value:
        return "medium"
    return PRIORITY_ALIASES.get(value.strip().lower(), "medium")


def _normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D+", "", value)
    if digits.startswith("20") and len(digits) == 12:
        return "+" + digits
    if digits.startswith("0") and len(digits) == 11:
        return "+20" + digits[1:]
    if len(digits) == 10 and digits.startswith("1"):
        return "+20" + digits
    return value.strip()


def _extract_phone(text: str) -> str | None:
    match = PHONE_PATTERN.search(text)
    return match.group(0) if match else None


def _extract_request_number(text: str) -> str | None:
    match = REQUEST_NUMBER_PATTERN.search(text)
    return match.group(0).upper() if match else None


def _extract_items(response: dict[str, Any]) -> list[dict[str, Any]]:
    data = response.get("data")
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        for key in ("items", "services", "results", "rows"):
            items = data.get(key)
            if isinstance(items, list):
                return [item for item in items if isinstance(item, dict)]
    return []


def _format_status_response(response: dict[str, Any]) -> str:
    if response.get("success") is False:
        return f"لم أستطع جلب حالة الطلب: {response.get('error') or response.get('message') or 'خطأ غير معروف'}"
    data = response.get("data") if isinstance(response.get("data"), dict) else response
    number = data.get("request_number") or data.get("tracking_number") or "غير متاح"
    status = data.get("status") or data.get("workflow_stage") or data.get("stage") or "غير متاح"
    priority = data.get("priority") or "غير محدد"
    title = data.get("title") or data.get("description") or "طلب صيانة"
    return f"حالة الطلب:\nرقم الطلب: {number}\nالعنوان: {title}\nالحالة الحالية: {status}\nالأولوية: {priority}"


def _format_details_response(response: dict[str, Any]) -> str:
    if response.get("success") is False:
        return f"لم أستطع جلب تفاصيل الطلب: {response.get('error') or response.get('message') or 'خطأ غير معروف'}"
    data = response.get("data") if isinstance(response.get("data"), dict) else response
    technician = data.get("technician") if isinstance(data.get("technician"), dict) else {}
    lines = [
        "تفاصيل طلب الصيانة:",
        f"رقم الطلب: {data.get('request_number') or data.get('tracking_number') or 'غير متاح'}",
        f"الحالة: {data.get('status') or data.get('workflow_stage') or data.get('stage') or 'غير متاح'}",
        f"نوع الخدمة: {data.get('service_type') or 'غير محدد'}",
        f"الأولوية: {data.get('priority') or 'غير محدد'}",
        f"العنوان: {data.get('location') or 'غير متاح'}",
        f"الوصف: {data.get('description') or data.get('title') or 'غير متاح'}",
    ]
    if technician:
        lines.append(f"الفني: {technician.get('name') or 'محدد'}")
        if technician.get("phone"):
            lines.append(f"هاتف الفني: {technician['phone']}")
    if data.get("cost") or data.get("total_cost"):
        lines.append(f"التكلفة: {data.get('cost') or data.get('total_cost')}")
    if data.get("sla"):
        lines.append(f"SLA: {data['sla']}")
    return "\n".join(lines)
