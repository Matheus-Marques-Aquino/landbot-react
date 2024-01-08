import React, { useState, useEffect, useRef } from 'react';
import Core from '@landbot/core';

import Datepicker from "react-tailwindcss-datepicker";

const messageTypes = ['text', 'dialog', 'multi_question', 'media_dialog', 'image', 'iframe', 'hidden', 'unknown'];

const formInputTypes = ['date', 'tel', 'email', 'number', 'text', 'autocomplete', 'media_dialog'];

function parseMessage(data) {
  return {
    ...data,
    key: data.key,
    text: data.title || data.message,
    author: data.samurai !== undefined ? 'bot' : 'user',
    timestamp: data.timestamp,
    type: data.type,
  };
}

function parseMessages(messages) {
  return Object.values(messages).reduce((obj, next) => {
    obj[next.key] = parseMessage(next);
    return obj;
  }, {});
}

function messagesFilter(data) {
  /** Support for basic message types */
  return ['text', 'dialog', 'multi_question', 'media_dialog'].includes(data.type);
}

function getMessageType(data) {
  return messageTypes.includes(data.type) ? data.type : 'unknown';
}

function scrollBottom(container) {
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }
}

export default function Chatbot() {
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState('');
  const [config, setConfig] = useState(null);
  const [inputSettings, setInputSettings] = useState({});
  const core = useRef(null);

  const [formStorage, setFormStorage] = useState({});

  const [dateValue, setDateValue] = useState({
    startDate: new Date(),
    endDate: new Date().setMonth(11)
  });

  //https://landbot.online/v3/H-2084994-V8LM3LGSZ96U4UH0/index.html

  useEffect(() => {
    fetch('https://storage.googleapis.com/landbot.online/v3/H-2084994-V8LM3LGSZ96U4UH0/index.json')
      .then(res => res.json())
      .then(setConfig);
  }, []);

  useEffect(() => {
    if (config) {
      core.current = new Core(config);
      
      core.current.pipelines.$readableSequence.subscribe(data => {
        console.log('Subscribe:', data);

        setMessages(messages => ({
          ...messages,
          [data.key]: parseMessage(data),
        }));
      });
  
      core.current.init().then(data => {
        let message = parseMessages(data.messages);

        //console.log('Response 0:', data);

        setMessages(message);
      });

      //core.current.events.on('new_message', function (message) {
      //  console.log('Listener:', message);
      //});
    }
  }, [config]);

  useEffect(() => {
    //console.log('Messages:', messages);

    const container = document.getElementById('landbot-messages-container');

    scrollBottom(container);
  }, [messages]);

  const submit = () => {
    if (input !== '' && core.current) {
      console.log('Input:', input);

      core.current.sendMessage({ message: input });

      setInput('');
    }
  };

  const inputDateHandler = (newValue) => {
    setDateValue(newValue);
  };

  function buttonAction(core, data, index, lastMessage) {  
    if (!lastMessage || !core || !data || !data.buttons || !data.payloads) {
      return;
    }

    if (!data.payloads[index] || !data.buttons[index]) {
      return;
    }
  
    let payload = {
      type: 'button',
      message: data.buttons[index],
      payload: data.payloads[index]
    };  

    let message = {
      key: '_' + data.key,
      text: payload.message,
      author: 'user',
      timestamp: data.timestamp,
      type: 'text',      
    };    
    
    //console.log('Payload:', payload);

    setMessages(messages => ({
      ...messages,
      [message.key]: message,
    }));

    core.sendMessage({...payload});
  }

  function phoneInputMask(value) {  
    const digits = value.replace(/\D/g, '');

    var formattedValue = '';

    if (digits.length > 10) {
      formattedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{1})(\d)/, '($1$2) ')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(\d{5})(\d)/, '$1');

    } else if (digits.length > 3) {
      formattedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{1})(\d)/, '($1$2) ')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .replace(/(\d{5})(\d)/, '$1');

    } else if (digits.length > 1) {
      formattedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{1})(\d)/, '($1$2) ');

    } else if (digits.length > 0) {
      formattedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{0})(\d)/, '($1$2');
    }
    
    return formattedValue;
  }

  function formatFormResponse(data, rows, core) {
    //console.log('Form Data:', data, rows)
    if (!data || !data.id || !rows || !Array.isArray(rows) || rows.length == 0) {
      return;
    }

    var form = { ...formStorage[data.id] };

    if ( !form ) {
      
      //return;
    }

    var response = {
      type: 'structured_data',
      message: '',
      data: {}
    };

    for(let i in rows) {
      let row = { ...rows[i] };

      if (!form[row.name]) {
        form[row.name] = {};
      }

      if (!form[row.name].value) {
        form[row.name].value = '';
      }

      let value = form[row.name].value || '';

      if (row.type == 'tel') {
        value = value.replace(/\D/g, '');
      }

      if (row.type == 'date') {
        if (/^[0-9]{4}\-[0-9]{2}\-[0-9]{2}$/.test(value)) {
          value = value.split('-').reverse().join('/');
        }
      }

      response.data[row.name] = value;

      response.message += "**" + row.label + ":** " + value;

      if (i < rows.length - 1) {
        response.message += '\n';
      }
    }

    console.log('Form Response:', response);

    core.sendMessage(response)
  }

  function inputFormHandler(e, id, input) {
    //console.log('Event:', e);

    if (input && input.type == 'date' && e && (e.startDate || e.startDate === null)) {
      e = {
        target: {
          value: e.startDate
        }
      };
    }

    if ( !e || !e.target || !id || !input ) {
      return;
    }

    var { value } = e.target;

    if (input && input.type == 'number' && input.options) {
      let { 
        minValue, 
        maxValue 
      } = input.options;

      if (/^[0-9]{1,}$/.test(minValue) && parseInt(value) < parseInt(minValue)) {
        value = minValue;
      }

      if (/^[0-9]{1,}$/.test(maxValue) && parseInt(value) > parseInt(maxValue)) {
        value = maxValue;
      }     
    }

    if (input && input.type == 'tel') {
      value = phoneInputMask(value);
    }

    var form = { ...formStorage[id] };

    form = form[input.label];

    if ( !form  ){
      form = {
        name: input.name,
        label: input.label,
        type: input.type,
        value: value,
      };
    }

    setFormStorage({
      ...formStorage,
      [id]: { 
        ...formStorage[id], 
        [input.name]: {
          ...form,
          value: value
        }
      }
    });
  }

  function renderButtons(data, lastMessage) {
    if ( !data || !data.type || data.type !== 'dialog' || !data.buttons ) {
      return (<></>);
    }

    if ( !Array.isArray(data.buttons) || data.buttons.length == 0 ) {
      return (<></>);
    }

    var btnClass = 'w-full';

    var {
      buttons,
      payloads,
      text,
      key
    } = data;

    if (!lastMessage) {
      buttons = [];
    }
  
    return (
      <article
        className="media landbot-message mb-2"
        key={key}
      >
        <div className="media-content landbot-message-content w-fit rounded-tr-[20px] rounded-tl-[20px] rounded-br-[20px] px-[15px] py-[8px] bg-[#41475E]">
          <div className="content">
            <p>{text}</p>
          </div>
        </div>
        <div className={`flex flex-wrap gap-2 text-center ${buttons.length > 0 ? 'mt-2' : 'mt-0' }`}>
          { buttons.map((button, index) => {
            return (
              <div 
                className={"flex-grow bg-[#D08406] rounded-[10px] px-[15px] py-[8px] text-white cusor-pointer min-w-[120px] cursor-pointer " + btnClass}
                onClick={()=>{ buttonAction(core.current, data, index, lastMessage) }}
              >
                { button }
              </div>
            );
          })}
        </div>
      </article>
    );
  } 

  function renderMediaDialog(data, lastMessage) {
    //console.log('Media Dialog:', data)
    //console.log('TESTE:', data.text)

    if ( !data || !data.type || data.type !== 'media_dialog' || !data.buttons ) {
      return (<></>);
    }

    if ( !Array.isArray(data.buttons) || data.buttons.length == 0 ) {
      return (<></>);
    }

    var btnClass = 'w-full';

    var {
      buttons,
      payloads,
      text,
      key
    } = data;

    //console.log(data.text)

    if (!lastMessage) {
      buttons = [];
    }    
  
    return (
      <article
        className="media landbot-message mb-2"
        key={key}
      >
        <div className="media-content landbot-message-content w-fit rounded-tr-[20px] rounded-tl-[20px] rounded-br-[20px] px-[15px] py-[15px] bg-[#41475E]">
          <div className="content">
            <img src={data.url} className="max-w-[250px]"/>
          </div>
        </div>
        <div className={`flex flex-wrap gap-2 text-center ${buttons.length > 0 ? 'mt-2' : 'mt-0' }`}>
          { buttons.map((button, index) => {
            return (
              <div 
                className={"flex-grow bg-[#D08406] rounded-[10px] px-[15px] py-[8px] text-white cusor-pointer min-w-[120px] cursor-pointer " + btnClass}
                onClick={()=>{ buttonAction(core.current, data, index, lastMessage) }}
              >
                { button }
              </div>
            );
          })}
        </div>
      </article>
    );
  } 

  function renderForm(data, lastMessage) {
    if ( !data || !data.type || data.type !== 'multi_question' || !data.rows ) {
      return (<></>);
    }

    if ( !Array.isArray(data.rows) || data.rows.length == 0 ) {
      return (<></>);
    }

    const renderInputDate = (input, id) => {
      let { options } = input;

      if (!options){
        return (<></>);
      }

      let minDate = null;
      let maxDate = null;

      let format = 'DD/MM/YYYY';

      if (options.format && /^[a-zA-Z]{2,4}\/[a-zA-Z]{2,4}\/[a-zA-Z]{2,4}$/.test(options.format)) {
        format = options.format.toUpperCase();
      }

      if ( options.enabledDatesType && options.enabledDatesType == 'future' ) {
        minDate = new Date();
        
        if ( !options.includeCurrentDate ) {
          minDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
        }
      }

      if ( options.enabledDatesType && options.enabledDatesType == 'past' ) {
        maxDate = new Date();
        
        if ( !options.includeCurrentDate ) {
          maxDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
        }
      }  
      
      var form = formStorage[data.id] || {};

      form = form[input.name];

      if ( !form ) {
        form = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: null,
        };         
      }

      return (
        <div className="text-[15px] mb-[10px]">
          <div className="mb-2 ml-1 font-medium text-[14px]">
            {input.label}
          </div>
          <div className="w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white">
            <Datepicker 
              containerClassName="w-full h-full text-gray-700 relative"
              inputClassName="w-full h-full rounded-[5px] focus:ring-0 border-0 font-normal dark:bg-green-900 dark:placeholder:text-green-100"
              asSingle={true}
              useRange={false} 
              value={{startDate: form.value, endDate: form.value}} 
              onChange={(e)=>{ inputFormHandler(e, data.id, input); }} 
              i18n={"pt-br"} 
              displayFormat={format} 
              minDate={minDate} 
              maxDate={maxDate}
            />
          </div>
        </div>
      )
    };

    const renderInputNumber = (input, id) => {
      let { options } = input;

      let min = null;
      let max = null;

      if (/^[0-9]{1,}$/.test(options.minValue)){
        min = options.minValue;
      }

      if (/^[0-9]{1,}$/.test(options.maxValue)){
        max = options.maxValue;
      }

      var form = formStorage[data.id] || {};

      form = form[input.name];

      if ( !form ) {
        form = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: '',
        };         
      }

      return (
        <div className="text-[15px] mb-[10px]">
          <div className="mb-2 ml-1 font-medium text-[14px]">
            {input.label}
          </div>
          <div className="w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white">
            <input 
              className="w-full h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
              type="number"
              min={min}
              max={max}
              value={form.value}
              onChange={(e)=>{ inputFormHandler(e, data.id, input); }} 
            />
          </div>
        </div>
      )
    };

    const renderAutocomplete = (input, id) => {
      let { buttons } = input;

      buttons = Object.values(buttons);

      //console.log('Autocomplete:', input.buttons)

      if (!buttons || !Array.isArray(buttons) || buttons.length == 0) {
        return (<></>);
      }

      var form = formStorage[data.id] || {};

      form = form[input.name];

      if ( !form ) {
        form = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: null,
        };         
      }

      return (
        <div className="text-[15px] mb-[10px]">
          <div className="mb-2 ml-1 font-medium text-[14px]">
            {input.label}
          </div>
          <div className="w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white">
            <select
              className="w-full h-full px-[10px] py-0 border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0"
              value={form.value}
              onChange={(e)=>{ inputFormHandler(e, data.id, input); }} 
            >
              <option value="">Selecione</option>
              { buttons.map((button, index) => {
                //console.log(button);

                return (
                  <option value={button.text}>{button.text}</option>
                );
              })}
            </select>
          </div>
        </div>
      );
    };

    const renderInputPhone = (input, id) => {
      var form = formStorage[data.id] || {};

      form = form[input.name];

      if ( !form ) {
        form = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: null,
        };         
      }

      return (
        <div className="text-[15px] mb-[10px]">
          <div className="mb-2 ml-1 font-medium text-[14px]">
            {input.label}
          </div>
          <div className="w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white">
            <input 
              className="w-full h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
              value={form.value}
              placeholder='(00) 00000-0000'
              onChange={(e)=>{ inputFormHandler(e, data.id, input); }} 
            />
          </div>
        </div>
      )
    }

    var {
      key,
      id,
      uuid,
      message,
      rich_text,
      rows 
    } = data;

    var rowsData = [];

    var formId = id || key || uuid;

    //console.log(rows);

    for(let i in rows) {
      let row = rows[i];

      if (!row || !row.inputs || !Array.isArray(row.inputs) || row.inputs.length == 0) {
        continue;
      }

      let input = { ...row.inputs[0] };

      let { extra } = input;

      if (!extra || (!extra.textarea && !extra.buttons) ) {
        continue;
      }

      delete input.extra;

      if (extra.textarea) {
        let { type, field } = extra.textarea;

        if (type == 'date') {
          input.options = { ...extra.textarea.dateOptions };
        }

        if (type == 'tel') {
          input.options = { ...extra.textarea };        
        }

        if (type == 'email') {
          input.options = { ...extra.textarea };                
        }

        if (type == 'number') {
          input.options = { ...extra.textarea }; 
        }

        if (type == 'text') {
          input.options = { ...extra.textarea };
        }

        if (type) {
          input._type = input.type;
          input.type = type;
        }

        if (field) {
          input.field = field
        }

        delete input.options.type;        
        delete input.options.field; 
      }

      if (extra.buttons) {
        let { type, field } = extra.buttons;

        if (type == 'autocomplete') {
          input.buttons = { ...extra.buttons.list };
        }

        if (type) {
          input._type = input.type;
          input.type = type;
        }

        if (field) {
          input.field = field
        }
      }

      rowsData[i] = input;
    }

    console.log('Rows:', rowsData);

    if (rowsData.length == 0) {
      return (<></>);
    }    

    return(
      <div
        className="w-full rounded-[10px] px-[15px] py-[15px] mb-[10px] bg-[#FFFFFF] drop-shadow-lg text-[16px] text-[#000000]"
      >
        <div className="text-[18px] mb-5 font-semibold">
          <div dangerouslySetInnerHTML={{ __html: rich_text }} />
        </div>
        {
          rowsData.map((input, index)=>{

            if (input.type == 'date') {
              return renderInputDate(input, formId);
            }

            if (input.type == 'number') {
              return renderInputNumber(input, formId);
            }

            if (input.type == 'autocomplete') {
              return renderAutocomplete(input, formId);
            }

            if (input.type == 'tel') {
              return renderInputPhone(input, formId);
            }

            //console.log('Input:', input)

            return(
              <div className="text-[15px] mb-[10px]">
                <div className="mb-[5px] ml-1 font-medium text-[14px]">
                  {input.label}
                </div>
                <div className="w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white">
                  <input 
                    className="w-full h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
                    onChange={(e)=>{ inputFormHandler(e, data.id, input); }}
                  />
                </div>
              </div>
            )
          })
        }
        <div 
          className="w-full text-[14px] py-[8px] text-center rounded-[5px] bg-[#D08406] text-white cursor-pointer mt-5 "
          onClick={()=>{ formatFormResponse(data, rowsData, core.current); }}  
        >
          Enviar
        </div>
      </div>
    )
  }

  /*
    - Verificar o tipo de mensagem
    - Imprimir botões
    - Responder mensagem com botão
    - Bloquear enviar se tiver botões
  */

  

  const MessageArray = 
    Object.values(messages)
      .filter(messagesFilter)
      .sort((a, b) => a.timestamp - b.timestamp); 

  //console.log('Messages:', MessageArray);  

  return (
    <div className='w-[425px] h-[550px] mx-auto rounded-[20px] bg-[#2C2F40] flex flex-col'>
      <div className="landbot-header font-montserrat px-[30px] py-[15px] bg-[#41475E] rounded-tl-[20px] rounded-tr-[20px] outline-0">
        <h1 className="subtitle leanding-[22px] font-normal text-white text-[20px]">Landbot Teste</h1>
      </div>

      <div
        className="landbot-messages-container leading-5 px-[10px] py-[36px] text-[16px] grow shrink basis-0 text-white scroll-px-0"
        id="landbot-messages-container"
        style={{ overflow: 'auto', scrollbarGutter: 'stable both-edges' }}
      >
        { MessageArray.map((message, index) => {      

            //console.log('_Message:', MessageArray, MessageArray.length);

            let lastMessage = MessageArray.length - 1 == index;

            let authorClass = message.author == 'user' ? ' rounded-bl-[20px] bg-[#D08406] ml-auto' : ' rounded-br-[20px] bg-[#41475E]';
            
            //console.log(message, lastMessage);

            if ( getMessageType(message) == 'multi_question') {
              return renderForm(message);
            }

            if ( getMessageType(message) == 'media_dialog' && lastMessage && !inputSettings.disabled) {
              setInputSettings({...inputSettings, disabled: true});
            }

            if ( getMessageType(message) == 'media_dialog' ) {
              //console.log('_Media Dialog:', message)
              let nextMessage = MessageArray[index + 1];

              if ( !lastMessage && nextMessage && nextMessage.type == 'media_dialog' && nextMessage.url == message.url) {
                return (<></>);
              } 

              return renderMediaDialog(message, lastMessage);
            }

            if ( getMessageType(message) == 'dialog' && lastMessage && !inputSettings.disabled) {
              setInputSettings({...inputSettings, disabled: true});
            }

            if ( getMessageType(message) == 'dialog' ) {              
              return renderButtons(message, lastMessage);
            }           

            return(
              <article
                className="media landbot-message mb-2"
                data-author={message.author}
                key={message.key}
              >
                <div className={"media-content landbot-message-content w-fit rounded-tr-[20px] rounded-tl-[20px] px-[15px] py-[8px]" + authorClass}>
                  <div className="content">
                    <p>{message.text}</p>
                  </div>
                </div>
              </article>
            );
          })}


      </div>


      <div className="landbot-input-container mt-auto bg-[#41475E] rounded-bl-[20px] rounded-br-[20px] outline-0 relative text-[16px] text-white">
        <div className="field">
          <div className="control">
            <input
              className={`landbot-input bg-transparent border-0 outline-0 py-[20px] pl-[25px] pr-[55px] cursor-text text-[16px] font-normal text-left w-full outline-none focus:ring-0 ${inputSettings.disabled ? 'cursor-not-allowed' : ''}`}
              onChange={e => setInput(e.target.value)}
              onKeyUp={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Type here..."
              type="text"
              value={input}
              disabled={inputSettings.disabled ? true : false}
            />
            <button
              className={`button landbot-input-send h-[36px] leading-[24px] flex px-[12px] py-[6px] background-transparent border-transparent absolute right-[20px] top-[50%] transform translate-y-[-50%] text-[#D08406] rounded-[5px] outline-none bg-[#FFFFFF]/[0.1] ${inputSettings.disabled ? ' opacity-60 cursor-not-allowed' : ' opacity-100 cursor-pointer'} `}
              disabled={input === ''}
              onClick={submit}
              type="button"
            >
              <span className={`icon is-large m-auto text-[25px] ${inputSettings.disabled ? 'opacity-70' : 'opacity-100'}`}>
                ➤
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}