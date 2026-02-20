import os
import json
import re
from typing import List, Optional
import httpx

from schemas import AIAnalysisResponse, TaskCreate, ExtractTasksResponse


class AIAnalyzer:
    """Service for analyzing meeting notes using AI (OpenAI or Anthropic)"""
    
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        
    async def analyze_notes(self, notes: str) -> AIAnalysisResponse:
        """
        Analyze meeting notes and extract insights, topics, and sentiment.
        Falls back to rule-based analysis if no API key is available.
        """
        if self.openai_api_key:
            return await self._analyze_with_openai(notes)
        elif self.anthropic_api_key:
            return await self._analyze_with_anthropic(notes)
        else:
            return self._analyze_with_rules(notes)
    
    async def _analyze_with_openai(self, notes: str) -> AIAnalysisResponse:
        """Use OpenAI API for analysis"""
        prompt = self._build_prompt(notes)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {"role": "system", "content": "You are an expert HR analyst specializing in 1:1 meeting analysis. Respond only with valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1000
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return self._parse_ai_response(content)
            else:
                return self._analyze_with_rules(notes)
    
    async def _analyze_with_anthropic(self, notes: str) -> AIAnalysisResponse:
        """Use Anthropic API for analysis"""
        prompt = self._build_prompt(notes)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 1000,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "system": "You are an expert HR analyst specializing in 1:1 meeting analysis. Respond only with valid JSON."
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data["content"][0]["text"]
                return self._parse_ai_response(content)
            else:
                return self._analyze_with_rules(notes)
    
    def _build_prompt(self, notes: str) -> str:
        """Build the analysis prompt"""
        return f"""Analyze the following 1:1 meeting notes and provide:
1. Key insights and observations
2. Main topics discussed (list of topic names)
3. Overall sentiment (positive, neutral, or negative)
4. Suggested action items based on the discussion

Meeting Notes:
---
{notes}
---

Respond in JSON format:
{{
    "insights": "Brief summary of key insights and observations",
    "topics": ["topic1", "topic2", "topic3"],
    "sentiment": "positive|neutral|negative",
    "action_items_suggested": ["action1", "action2"]
}}"""
    
    def _parse_ai_response(self, content: str) -> AIAnalysisResponse:
        """Parse AI response JSON"""
        try:
            # Clean up the response (remove markdown code blocks if present)
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            
            data = json.loads(content.strip())
            return AIAnalysisResponse(
                insights=data.get("insights", ""),
                topics=data.get("topics", []),
                sentiment=data.get("sentiment", "neutral"),
                action_items_suggested=data.get("action_items_suggested", [])
            )
        except json.JSONDecodeError:
            return AIAnalysisResponse(
                insights=content,
                topics=[],
                sentiment="neutral",
                action_items_suggested=[]
            )
    
    def _analyze_with_rules(self, notes: str) -> AIAnalysisResponse:
        """Rule-based fallback analysis when no API key is available"""
        notes_lower = notes.lower()
        
        # Extract topics based on keywords
        topic_keywords = {
            "career": ["career", "promotion", "growth", "קידום", "קריירה"],
            "feedback": ["feedback", "review", "פידבק", "משוב"],
            "blockers": ["blocker", "stuck", "problem", "issue", "חסימה", "בעיה"],
            "project": ["project", "deadline", "delivery", "פרויקט", "דדליין"],
            "personal": ["personal", "family", "health", "אישי", "משפחה", "בריאות"],
            "learning": ["learning", "course", "training", "למידה", "קורס", "הכשרה"],
            "team": ["team", "collaboration", "צוות", "שיתוף פעולה"],
            "workload": ["workload", "overtime", "stress", "עומס", "שעות נוספות", "לחץ"]
        }
        
        topics = []
        for topic, keywords in topic_keywords.items():
            if any(kw in notes_lower for kw in keywords):
                topics.append(topic)
        
        # Determine sentiment
        positive_words = ["great", "excellent", "happy", "good", "success", "מצוין", "טוב", "שמח", "הצלחה"]
        negative_words = ["problem", "issue", "frustrated", "unhappy", "difficult", "בעיה", "מתוסכל", "קשה"]
        
        positive_count = sum(1 for word in positive_words if word in notes_lower)
        negative_count = sum(1 for word in negative_words if word in notes_lower)
        
        if positive_count > negative_count:
            sentiment = "positive"
        elif negative_count > positive_count:
            sentiment = "negative"
        else:
            sentiment = "neutral"
        
        # Generate insights
        insights_parts = []
        if topics:
            insights_parts.append(f"Main discussion areas: {', '.join(topics)}.")
        if sentiment == "positive":
            insights_parts.append("Overall positive tone in the conversation.")
        elif sentiment == "negative":
            insights_parts.append("Some concerns or challenges were discussed.")
        
        insights = " ".join(insights_parts) if insights_parts else "Standard 1:1 discussion."
        
        # Suggest action items based on content
        action_items = []
        if "blocker" in notes_lower or "חסימה" in notes_lower:
            action_items.append("Follow up on blockers mentioned")
        if "deadline" in notes_lower or "דדליין" in notes_lower:
            action_items.append("Review project timeline")
        if "feedback" in notes_lower or "משוב" in notes_lower:
            action_items.append("Provide requested feedback")
        
        return AIAnalysisResponse(
            insights=insights,
            topics=topics if topics else ["general"],
            sentiment=sentiment,
            action_items_suggested=action_items
        )

    async def extract_tasks_from_notes(
        self, 
        notes: str, 
        person_id: Optional[int] = None,
        meeting_id: Optional[int] = None
    ) -> ExtractTasksResponse:
        """
        Extract tasks from meeting notes using AI or rule-based approach.
        """
        if self.openai_api_key:
            return await self._extract_tasks_openai(notes, person_id, meeting_id)
        elif self.anthropic_api_key:
            return await self._extract_tasks_anthropic(notes, person_id, meeting_id)
        else:
            return self._extract_tasks_rules(notes, person_id, meeting_id)

    async def _extract_tasks_openai(
        self, notes: str, person_id: Optional[int], meeting_id: Optional[int]
    ) -> ExtractTasksResponse:
        """Use OpenAI to extract tasks"""
        prompt = self._build_task_extraction_prompt(notes)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {"role": "system", "content": "You are an expert at extracting action items and tasks from meeting notes. Respond only with valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1000
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return self._parse_tasks_response(content, person_id, meeting_id)
            else:
                return self._extract_tasks_rules(notes, person_id, meeting_id)

    async def _extract_tasks_anthropic(
        self, notes: str, person_id: Optional[int], meeting_id: Optional[int]
    ) -> ExtractTasksResponse:
        """Use Anthropic to extract tasks"""
        prompt = self._build_task_extraction_prompt(notes)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 1000,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "system": "You are an expert at extracting action items and tasks from meeting notes. Respond only with valid JSON."
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data["content"][0]["text"]
                return self._parse_tasks_response(content, person_id, meeting_id)
            else:
                return self._extract_tasks_rules(notes, person_id, meeting_id)

    def _build_task_extraction_prompt(self, notes: str) -> str:
        """Build prompt for task extraction"""
        return f"""Extract action items and tasks from the following meeting notes.
For each task, identify:
- title: Brief task title
- description: Optional detailed description
- priority: low, medium, or high based on urgency
- task_type: "from_meeting" (since these come from a meeting)

Meeting Notes:
---
{notes}
---

Respond in JSON format:
{{
    "tasks": [
        {{
            "title": "Task title",
            "description": "Optional description",
            "priority": "medium",
            "task_type": "from_meeting"
        }}
    ]
}}

Only include clear action items. If no tasks are found, return an empty array."""

    def _parse_tasks_response(
        self, content: str, person_id: Optional[int], meeting_id: Optional[int]
    ) -> ExtractTasksResponse:
        """Parse AI response for tasks"""
        try:
            # Clean up response
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            
            data = json.loads(content.strip())
            tasks = []
            
            for task_data in data.get("tasks", []):
                task = TaskCreate(
                    title=task_data.get("title", ""),
                    description=task_data.get("description"),
                    task_type="from_meeting",
                    priority=task_data.get("priority", "medium"),
                    person_id=person_id,
                    meeting_id=meeting_id
                )
                if task.title:
                    tasks.append(task)
            
            return ExtractTasksResponse(suggested_tasks=tasks)
        except json.JSONDecodeError:
            return ExtractTasksResponse(suggested_tasks=[])

    def _extract_tasks_rules(
        self, notes: str, person_id: Optional[int], meeting_id: Optional[int]
    ) -> ExtractTasksResponse:
        """Rule-based task extraction fallback"""
        tasks = []
        lines = notes.split('\n')
        
        # Patterns that indicate action items
        action_patterns = [
            r'^\s*[-•*]\s*(?:TODO|לעשות|משימה|action item)[:：]?\s*(.+)',
            r'^\s*[-•*]\s*צריך\s+(.+)',
            r'^\s*[-•*]\s*need to\s+(.+)',
            r'^\s*[-•*]\s*should\s+(.+)',
            r'^\s*[-•*]\s*will\s+(.+)',
            r'(?:TODO|לעשות|משימה)[:：]\s*(.+)',
        ]
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            for pattern in action_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    title = match.group(1).strip()
                    if len(title) > 5:  # Filter very short matches
                        # Determine priority based on keywords
                        priority = "medium"
                        if any(word in line.lower() for word in ["urgent", "דחוף", "asap", "critical"]):
                            priority = "high"
                        elif any(word in line.lower() for word in ["when possible", "כשיהיה זמן", "low priority"]):
                            priority = "low"
                        
                        task = TaskCreate(
                            title=title[:200],  # Limit length
                            description=None,
                            task_type="from_meeting",
                            priority=priority,
                            person_id=person_id,
                            meeting_id=meeting_id
                        )
                        tasks.append(task)
                    break
        
        return ExtractTasksResponse(suggested_tasks=tasks)
