let _io = null;

const setIO = (io) => {
  _io = io;
};

const getIO = () => {
  if (!_io) throw new Error("Socket.io not initialized");
  return _io;
};

module.exports = { setIO, getIO };
