import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Fab, Box, Paper, Typography, IconButton, TextField, Button, Divider, useTheme, Slide,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';

const AIChatWidget = ({ onSendMessage }) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // 스크롤을 항상 최신 메시지로 이동
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleCloseChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSend = useCallback(() => {
    if (message.trim()) {
      // 사용자 메시지를 채팅에 추가
      const userMessage = { type: 'user', content: message.trim() };
      setMessages(prev => [...prev, userMessage]);
      
      // 로딩 상태 설정
      setIsLoading(true);
      
      if (onSendMessage) {
        try {
          // 메시지 수신 콜백 함수
          const messageCallback = (response) => {
            // 응답이 없거나 null인 경우 처리
            if (!response) {
              setMessages(prev => [...prev, {
                type: 'error',
                content: '응답이 없습니다. 다시 시도해주세요.'
              }]);
              setIsLoading(false);
              return;
            }
            
            const responseType = response.type === 'error' ? 'error' : 'ai';
            setMessages(prev => [...prev, {
              type: responseType,
              content: response.content || '응답 내용이 없습니다.'
            }]);
            setIsLoading(false);
          };
          
          // AI에 메시지 전송 (콜백 함수 전달)
          onSendMessage(message.trim(), messageCallback);
          
          // 처리 중 메시지 추가
          setMessages(prev => [...prev, {
            type: 'ai',
            content: '요청을 처리 중입니다...'
          }]);
        } catch (error) {
          // 오류 처리
          setMessages(prev => [...prev, {
            type: 'error',
            content: '메시지 전송 중 오류가 발생했습니다.'
          }]);
          setIsLoading(false);
        }
      }
      setMessage('');
    }
  }, [message, onSendMessage]);

  const renderMessages = () => {
    return messages.map((msg, index) => (
      <Box
        key={index}
        sx={{
          p: 1.5,
          mb: 1.5,
          maxWidth: '80%',
          borderRadius: '12px',
          alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
          bgcolor: msg.type === 'user'
            ? theme.palette.primary.light
            : msg.type === 'error'
              ? theme.palette.error.light
              : theme.palette.grey[100],
          color: msg.type === 'user'
            ? theme.palette.primary.contrastText
            : msg.type === 'error'
              ? theme.palette.error.contrastText
              : theme.palette.text.primary
        }}
      >
        <Typography variant="body2">{msg.content}</Typography>
      </Box>
    ));
  };

  return (
    <Box sx={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1050 }}>
      {/* Chat Window */}
      <Slide direction="up" in={isOpen} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            width: 360,
            height: 500,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: theme.palette.background.paper,
            mb: theme.spacing(10), // Fab 높이(8) + 추가 간격(2)
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 1.5,
              backgroundColor: theme.palette.primary.main,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
            }}
          >
            <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 'bold' }}>
              AI 여행 비서 ✦
            </Typography>
            <IconButton onClick={handleCloseChat} size="small">
              <CloseIcon sx={{ color: 'white' }} />
            </IconButton>
          </Box>

          {/* Message Area */}
          <Box
            sx={{
              flexGrow: 1,
              p: 2,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {messages.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                AI에게 여행 계획 변경을 요청해보세요. (예: "내일 일정을 좀 더 여유롭게 바꿔줘")
              </Typography>
            ) : (
              renderMessages()
            )}
            <div ref={messagesEndRef} />
          </Box>

          <Divider />

          {/* Input Area */}
          <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', backgroundColor: theme.palette.background.default }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="메시지를 입력하세요..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isLoading}
              sx={{ mr: 1 }}
            />
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={!message.trim() || isLoading}
              sx={{
                backgroundColor: theme.palette.primary.main,
                minWidth: 'auto',
                padding: '8px',
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                }
              }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
            </Button>
          </Box>
        </Paper>
      </Slide>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="toggle-ai-chat"
        onClick={toggleChat} // 버튼 클릭 시 채팅창 토글
        sx={{
          position: 'absolute', // 채팅창과 독립적인 위치 고정
          bottom: 0, // Box의 bottom: 32, right: 32 기준으로 위치
          right: 0,  // Box의 bottom: 32, right: 32 기준으로 위치
          boxShadow: theme.shadows[6],
          '&:hover': {
            backgroundColor: theme.palette.primary.dark,
          },
          width: '64px',
          height: '64px',
        }}
      >
        <Box sx={{ 
          position: 'relative', 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          {/* Big Star (Center) - 정확히 중앙 정렬 */}
          <Typography sx={{ 
            fontSize: '32px',
            color: 'white', 
            lineHeight: '1',
            position: 'absolute',
            transform: 'scaleY(1.2)',
            top: '50%', 
            left: '50%',
            marginTop: '-16px', // 폰트 크기의 절반
            marginLeft: '-16px', // 폰트 크기의 절반
          }}>
            ✦
          </Typography>
          {/* Small Star (Left-Top Diagonal) */}
          <Typography sx={{ 
            fontSize: '16px', 
            color: 'white', 
            lineHeight: '1',
            position: 'absolute',
            top: '13px', 
            left: '12px',
            transform: 'rotate(-15deg)',
          }}>
            ✦
          </Typography>
          {/* Small Star (Bottom-Right Diagonal) */}
          <Typography sx={{ 
            fontSize: '14px', 
            color: 'white', 
            lineHeight: '1',
            position: 'absolute',
            bottom: '13px', 
            right: '12px',
            transform: 'rotate(20deg)',
          }}>
            ✦
          </Typography>
        </Box>
      </Fab>
    </Box>
  );
};

export default AIChatWidget; 